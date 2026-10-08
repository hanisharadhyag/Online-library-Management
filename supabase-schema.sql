-- ==============================================================
-- LibraryHub: Online Library Management System
-- Supabase PostgreSQL Schema, Security Policies, Triggers & RPCs
-- ==============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------
-- 1. PROFILES TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on role for fast access checks
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- --------------------------------------------------------------
-- 2. HELPER FUNCTIONS FOR SECURITY DEFINER
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- --------------------------------------------------------------
-- 3. AUTOMATIC PROFILE CREATION TRIGGER
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT := 'member';
BEGIN
    -- Check if this is the very first user in the database.
    -- If so, assign admin role to bootstrap the system safely.
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
        v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, name, email, role, created_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        v_role,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------
-- 4. BOOKS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0 AND available_copies <= total_copies),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_category ON public.books(category);
CREATE INDEX IF NOT EXISTS idx_books_title ON public.books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON public.books(author);

-- --------------------------------------------------------------
-- 5. BORROWINGS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.borrowings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue')),
    fine NUMERIC NOT NULL DEFAULT 0 CHECK (fine >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON public.borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_id ON public.borrowings(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON public.borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON public.borrowings(due_date);

-- --------------------------------------------------------------
-- 6. BORROW BOOK RPC (TRANSACTION-SAFE & RACE-FREE)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.borrow_book(p_book_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_available INTEGER;
    v_total INTEGER;
    v_book_title TEXT;
    v_borrowing_id UUID;
    v_due_date TIMESTAMPTZ;
BEGIN
    -- 1. Verify authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to borrow a book.';
    END IF;

    -- Ensure profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
        INSERT INTO public.profiles (id, email, name, role)
        SELECT v_user_id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'member'
        FROM auth.users WHERE id = v_user_id;
    END IF;

    -- 2. Lock book row and check availability
    SELECT available_copies, total_copies, title
    INTO v_available, v_total, v_book_title
    FROM public.books
    WHERE id = p_book_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Book not found.';
    END IF;

    IF v_available <= 0 THEN
        RAISE EXCEPTION 'This book is currently out of stock.';
    END IF;

    -- 3. Prevent duplicate active borrowings by same user
    IF EXISTS (
        SELECT 1 FROM public.borrowings
        WHERE user_id = v_user_id
          AND book_id = p_book_id
          AND returned_at IS NULL
    ) THEN
        RAISE EXCEPTION 'You already have an active borrowing for this book.';
    END IF;

    -- 4. Calculate due date (14 days from now)
    v_due_date := NOW() + INTERVAL '14 days';

    -- 5. Create borrowing record
    INSERT INTO public.borrowings (user_id, book_id, borrowed_at, due_date, status, fine)
    VALUES (v_user_id, p_book_id, NOW(), v_due_date, 'borrowed', 0)
    RETURNING id INTO v_borrowing_id;

    -- 6. Decrease available copies
    UPDATE public.books
    SET available_copies = available_copies - 1
    WHERE id = p_book_id;

    -- 7. Return success payload
    RETURN jsonb_build_object(
        'success', true,
        'borrowing_id', v_borrowing_id,
        'book_id', p_book_id,
        'title', v_book_title,
        'due_date', v_due_date,
        'available_copies', v_available - 1
    );
END;
$$;

-- --------------------------------------------------------------
-- 7. RETURN BOOK RPC (FINE CALCULATION & INVENTORY RESTORE)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_book(p_borrowing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
    v_borrowing RECORD;
    v_overdue_days INTEGER := 0;
    v_fine NUMERIC := 0;
    v_book_title TEXT;
BEGIN
    -- 1. Verify authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to return a book.';
    END IF;

    v_is_admin := public.is_admin();

    -- 2. Fetch and lock borrowing record
    SELECT b.*, bk.title AS book_title, bk.total_copies, bk.available_copies
    INTO v_borrowing
    FROM public.borrowings b
    JOIN public.books bk ON b.book_id = bk.id
    WHERE b.id = p_borrowing_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Borrowing record not found.';
    END IF;

    -- 3. Verify ownership or admin privileges
    IF v_borrowing.user_id <> v_user_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'You are not authorized to return this borrowing.';
    END IF;

    -- 4. Prevent returning already returned book
    IF v_borrowing.returned_at IS NOT NULL THEN
        RAISE EXCEPTION 'This book has already been returned.';
    END IF;

    -- 5. Calculate overdue days and fine (₹5 per overdue day)
    IF NOW() > v_borrowing.due_date THEN
        v_overdue_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - v_borrowing.due_date)) / 86400.0)::INTEGER);
        v_fine := v_overdue_days * 5.0;
    ELSE
        v_overdue_days := 0;
        v_fine := 0.0;
    END IF;

    -- 6. Update borrowing record
    UPDATE public.borrowings
    SET returned_at = NOW(),
        status = 'returned',
        fine = v_fine
    WHERE id = p_borrowing_id;

    -- 7. Increase available copies safely (never exceed total_copies)
    UPDATE public.books
    SET available_copies = LEAST(total_copies, available_copies + 1)
    WHERE id = v_borrowing.book_id;

    -- 8. Return result
    RETURN jsonb_build_object(
        'success', true,
        'borrowing_id', p_borrowing_id,
        'book_id', v_borrowing.book_id,
        'book_title', v_borrowing.book_title,
        'returned_at', NOW(),
        'overdue_days', v_overdue_days,
        'fine', v_fine
    );
END;
$$;

-- --------------------------------------------------------------
-- 8. OVERDUE REFRESH RPC
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_overdue_borrowings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    WITH updated AS (
        UPDATE public.borrowings
        SET status = 'overdue',
            fine = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400.0)::INTEGER) * 5.0
        WHERE returned_at IS NULL
          AND due_date < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;

    RETURN v_updated_count;
END;
$$;

-- --------------------------------------------------------------
-- 9. ADMIN ROLE MANAGEMENT RPC
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_caller_admin BOOLEAN := FALSE;
    v_target_id UUID;
BEGIN
    SELECT role = 'admin' INTO v_is_caller_admin FROM public.profiles WHERE id = v_caller_id;

    -- Allow bootstrap promotion if no admin exists yet
    IF NOT v_is_caller_admin AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
        RAISE EXCEPTION 'Only an administrator can promote members to admin.';
    END IF;

    SELECT id INTO v_target_id FROM public.profiles WHERE LOWER(email) = LOWER(target_email);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile with email % not found.', target_email;
    END IF;

    UPDATE public.profiles SET role = 'admin' WHERE id = v_target_id;

    RETURN jsonb_build_object('success', true, 'email', target_email, 'role', 'admin');
END;
$$;

-- --------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowings ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;

DROP POLICY IF EXISTS "Books select policy" ON public.books;
DROP POLICY IF EXISTS "Books admin insert policy" ON public.books;
DROP POLICY IF EXISTS "Books admin update policy" ON public.books;
DROP POLICY IF EXISTS "Books admin delete policy" ON public.books;

DROP POLICY IF EXISTS "Borrowings select policy" ON public.borrowings;
DROP POLICY IF EXISTS "Borrowings insert policy" ON public.borrowings;
DROP POLICY IF EXISTS "Borrowings update policy" ON public.borrowings;

-- PROFILES POLICIES
-- Users can view their own profile, or admins can view all profiles
CREATE POLICY "Profiles select policy" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- Users can update only their own name; admins can update any profile (including roles)
CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        public.is_admin() OR
        (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
    );

-- BOOKS POLICIES
-- Anyone authenticated or public can browse the library catalog
CREATE POLICY "Books select policy" ON public.books
    FOR SELECT
    TO public
    USING (true);

-- Only admins can insert, update, or delete books
CREATE POLICY "Books admin insert policy" ON public.books
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Books admin update policy" ON public.books
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Books admin delete policy" ON public.books
    FOR DELETE
    USING (public.is_admin());

-- BORROWINGS POLICIES
-- Members can view only their borrowings; Admins can view all borrowings
CREATE POLICY "Borrowings select policy" ON public.borrowings
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Insert and update borrowings (also handled by RPC functions)
CREATE POLICY "Borrowings insert policy" ON public.borrowings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Borrowings update policy" ON public.borrowings
    FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- --------------------------------------------------------------
-- 11. INITIAL SAMPLE DATA SEEDING (15 BOOKS)
-- --------------------------------------------------------------
INSERT INTO public.books (title, author, isbn, category, description, total_copies, available_copies, image_url)
VALUES
(
    'Clean Code: A Handbook of Agile Software Craftsmanship',
    'Robert C. Martin',
    '978-0132350884',
    'Programming',
    'Even bad code can function. But if code isn''t clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost due to poorly written code.',
    5, 4,
    'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80'
),
(
    'The Pragmatic Programmer: Your Journey to Mastery',
    'David Thomas, Andrew Hunt',
    '978-0135957059',
    'Programming',
    'One of the most significant books on computer programming. Examines the core of modern development: personal responsibility and career development in software design.',
    4, 3,
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'
),
(
    'Designing Data-Intensive Applications',
    'Martin Kleppmann',
    '978-1449373320',
    'Technology',
    'Data is at the center of many challenges in system design today. Difficult issues need to be figured out, such as scalability, consistency, reliability, efficiency, and maintainability.',
    3, 2,
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'
),
(
    'Atomic Habits',
    'James Clear',
    '978-0735211292',
    'Self-help',
    'No matter your goals, Atomic Habits offers a proven framework for improving every day. Learn how tiny changes can lead to remarkable results.',
    6, 5,
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80'
),
(
    'Deep Work: Rules for Focused Success in a Distracted World',
    'Cal Newport',
    '978-1455586691',
    'Self-help',
    'Deep work is the ability to focus without distraction on a cognitively demanding task. It''s a skill that allows you to quickly master complicated information and produce better results in less time.',
    4, 3,
    'https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=600&q=80'
),
(
    'Zero to One: Notes on Startups, or How to Build the Future',
    'Peter Thiel, Blake Masters',
    '978-0804139298',
    'Business',
    'The great secret of our time is that there are still uncharted frontiers to explore and new inventions to create. In Zero to One, legendary entrepreneur Peter Thiel shows how we can find singular ways to create those new things.',
    4, 4,
    'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=600&q=80'
),
(
    'The Lean Startup',
    'Eric Ries',
    '978-0307887894',
    'Business',
    'Most startups fail. But many of those failures are preventable. The Lean Startup is a new approach being adopted across the globe, changing the way companies are built and new products are launched.',
    5, 3,
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'
),
(
    'A Brief History of Time',
    'Stephen Hawking',
    '978-0553380163',
    'Science',
    'A landmark volume in science writing by one of the great minds of our time, Stephen Hawking explores the most profound questions of cosmology: How did the universe begin? Can time run backward?',
    3, 2,
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80'
),
(
    'Sapiens: A Brief History of Humankind',
    'Yuval Noah Harari',
    '978-0062316097',
    'Science',
    'One hundred thousand years ago, at least six different species of humans inhabited Earth. Yet today there is only one—Homo sapiens. What happened to the others? And what may happen to us?',
    5, 5,
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80'
),
(
    '1984',
    'George Orwell',
    '978-0451524935',
    'Fiction',
    'Winston Smith toes the Party line, rewriting history to satisfy the Ministry of Truth. With each lie he writes, Winston grows to hate the Party that seeks power for its own sake and persecutes individualism.',
    6, 4,
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80'
),
(
    'To Kill a Mockingbird',
    'Harper Lee',
    '978-0061120084',
    'Fiction',
    'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, exploring compassion and dramatic courage through the eyes of Scout Finch.',
    4, 2,
    'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80'
),
(
    'Artificial Intelligence: A Modern Approach',
    'Stuart Russell, Peter Norvig',
    '978-0136042594',
    'Technology',
    'The long-anticipated revision of this best-selling text offers the most comprehensive, up-to-date introduction to the theory and practice of artificial intelligence in theory and implementation.',
    3, 1,
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80'
),
(
    'Introduction to Algorithms (CLRS)',
    'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
    '978-0262033848',
    'Programming',
    'Comprehensive textbook covering modern study of algorithms. Features detailed explanations, rigor, and elementary presentations without sacrificing depth of analysis.',
    4, 2,
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=600&q=80'
),
(
    'Thinking, Fast and Slow',
    'Daniel Kahneman',
    '978-0374533557',
    'Science',
    'The New York Times bestseller takes us on a groundbreaking tour of the mind and explains the two systems that drive the way we think: System 1 is fast and emotional; System 2 is slower and logical.',
    4, 3,
    'https://images.unsplash.com/photo-1507842229451-7f01be837a28?auto=format&fit=crop&w=600&q=80'
),
(
    'The Psychology of Money',
    'Morgan Housel',
    '978-0857197689',
    'Business',
    'Doing well with money isn''t necessarily about what you know. It''s about how you behave. And behavior is hard to teach, even to really smart people.',
    5, 4,
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80'
)
ON CONFLICT (isbn) DO NOTHING;
