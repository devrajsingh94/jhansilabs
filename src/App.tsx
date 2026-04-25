import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Home as HomeIcon, 
  Calendar, 
  Clock, 
  ChevronRight, 
  ShieldCheck, 
  Phone, 
  Menu, 
  X,
  ArrowRight,
  Filter,
  CheckCircle2,
  Stethoscope,
  Microscope,
  User,
  LogOut,
  History,
  Loader2,
  Users,
  Package,
  Tag,
  ExternalLink,
  Mail,
  Award,
  Lock,
  Eye,
  EyeOff,
  FileText,
  Download,
  Upload,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AVAILABLE_TESTS, TEST_CATEGORIES, STAFF_MEMBERS, LAB_LOCATIONS, HEALTH_PACKAGES } from './constants';
import { LabTest, BookingType, Booking, PatientTest, BookingStatus } from './types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'packages' | 'tests' | 'terms'>('home');
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [showSearchTip, setShowSearchTip] = useState(false);
  const [hasShownSearchTip, setHasShownSearchTip] = useState(false);
  const [bookingStep, setBookingStep] = useState<'details' | 'type' | 'form' | 'confirm'>('details');
  const [bookingType, setBookingType] = useState<BookingType>('home');
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    phone: '',
    age: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00 AM',
    location: '',
    doctorReference: '',
    referralCode: '',
    prescriptionUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [showPatientHistory, setShowPatientHistory] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);

  useEffect(() => {
    const hasSeenNotice = localStorage.getItem('jhansi_location_notice');
    if (!hasSeenNotice) {
      const timer = setTimeout(() => setShowLocationPopup(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot-password'>('signup');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUploadForm, setAdminUploadForm] = useState({
    patientId: '',
    bookingId: '',
    files: {} as { [testId: string]: File | null },
    isUploading: false,
    status: 'pending' as BookingStatus,
    collectionTime: '',
    uploadProgress: 0
  });

  // Auth Listener
  useEffect(() => {
    let userDocUnsubscribe: (() => void) | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Cleanup previous user doc listener if it exists
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      setUser(currentUser);
      setIsAuthLoading(false);
      
      if (currentUser) {
        // Set initial admin status based on email AND verification
        const isDefaultAdmin = (currentUser.email === 'drstech94@gmail.com' || currentUser.email === 'jhansilabs@gmail.com') && currentUser.emailVerified;
        setIsAdmin(isDefaultAdmin);

        // Sync user profile to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || '',
            lastLogin: Date.now(),
            role: isDefaultAdmin ? 'admin' : 'user'
          }, { merge: true });

          // Listener for user data
          userDocUnsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              setUserData(doc.data());
            }
          }, (error) => {
            console.error("User doc listener error:", error);
          });
        } catch (err) {
          console.error("Error syncing user:", err);
        }
      } else {
        setIsAdmin(false);
        setUserData(null);
      }
    });

    return () => {
      unsubscribe();
      if (userDocUnsubscribe) userDocUnsubscribe();
    };
  }, []);

  // Current User Role Listener - secondary check to handle role updates
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        // Check both custom role and hardcoded email verification
        setIsAdmin(userData.role === 'admin' || ((user.email === 'drstech94@gmail.com' || user.email === 'jhansilabs@gmail.com') && user.emailVerified));
      }
    }, (error) => {
      console.error("Admin check listener error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Admin Listeners
  useEffect(() => {
    if (!isAdmin) {
      setAllBookings([]);
      setAllUsers([]);
      return;
    }

    // Listen to all bookings
    const bookingsUnsubscribe = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
        setAllBookings(bookings);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );

    // Listen to all users
    const usersUnsubscribe = onSnapshot(
      query(collection(db, 'users'), orderBy('displayName', 'asc')), 
      (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(users);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    return () => {
      bookingsUnsubscribe();
      usersUnsubscribe();
    };
  }, [isAdmin]);

  // Bookings Listener
  useEffect(() => {
    if (!user) {
      setUserBookings([]);
      return;
    }

    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      setUserBookings(bookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time report notifications
  const notifiedReportsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!user) {
      notifiedReportsRef.current.clear();
      isInitialLoadRef.current = true;
      return;
    }

    if (userBookings.length > 0) {
      if (isInitialLoadRef.current) {
        // Initial load: Mark all existing reports as "notified" to avoid spamming on login
        userBookings.forEach(booking => {
          if (booking.reportUrl || (booking as any).reports && Object.keys((booking as any).reports).length > 0) {
            notifiedReportsRef.current.add(booking.id);
          }
        });
        isInitialLoadRef.current = false;
      } else {
        // Subsequent updates: Check for new reports
        userBookings.forEach(booking => {
          const hasReport = booking.reportUrl || (booking as any).reports && Object.keys((booking as any).reports).length > 0;
          const isNewlyCompleted = hasReport && !notifiedReportsRef.current.has(booking.id);
          
          if (isNewlyCompleted) {
            toast.success('Medical Report Ready!', {
              description: `The report for "${booking.tests[0]?.name}" is now available in your history.`,
              duration: 8000,
              action: {
                label: 'View History',
                onClick: () => {
                  setShowPatientHistory(true);
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }
            });
            notifiedReportsRef.current.add(booking.id);
          }
        });
      }
    }
  }, [userBookings, user]);

  const handleSignIn = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully!');
      setShowAuthModal(false);
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.info('Sign-in cancelled');
      } else {
        toast.error('Failed to sign in');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password || (authMode === 'signup' && !authForm.name)) {
      toast.error('Please fill in all fields');
      return;
    }

    if (authMode === 'signup' && !termsAccepted) {
      toast.error('Please accept the Terms & Conditions to continue');
      return;
    }

    if (authForm.password.length < 6) {
      toast.error('Password should be at least 6 characters');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        await updateProfile(userCredential.user, { 
          displayName: authForm.name.trim(),
          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authForm.name.trim())}`
        });
        
        // Save initial profile
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: authForm.email.trim(),
          displayName: authForm.name.trim(),
          role: 'user',
          createdAt: Date.now(),
          lastLogin: Date.now()
        }, { merge: true });

        toast.success(`Welcome, ${authForm.name}! Account created.`);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        toast.success(`Welcome back, ${userCredential.user.displayName || 'User'}!`);
      }
      setShowAuthModal(false);
      setAuthForm({ email: '', password: '', name: '' });
    } catch (error: any) {
      console.error('Auth error detailed:', error);
      let message = 'Authentication failed';
      
      const errorCode = error.code || (error.message?.includes('auth/') ? error.message.match(/auth\/[a-z0-9-]+/)?.[0] : null);

      if (errorCode) {
        if (errorCode === 'auth/operation-not-allowed') {
          message = 'Email sign-in is not enabled. Go to Firebase Console > Auth > Sign-in method to enable it.';
        } else if (errorCode === 'auth/email-already-in-use') {
          message = 'This email is already registered. Please sign in instead.';
        } else if (errorCode === 'auth/invalid-credential') {
          message = 'Invalid email or password. Please try again.';
        } else if (errorCode === 'auth/weak-password') {
          message = 'Password is too weak. Use at least 6 characters.';
        } else if (errorCode === 'auth/user-not-found') {
          message = 'No account found with this email. Please sign up first.';
        } else if (errorCode === 'auth/wrong-password') {
          message = 'Incorrect password. Please try again.';
        } else {
          message = error.message || 'Authentication error';
        }
      } else if (error.message?.includes('permission-denied') || error.message?.includes('permissions')) {
        message = 'Profile sync failed. Your account was created, but we couldn\'t save your profile details.';
      } else {
        message = error.message || 'An unexpected error occurred';
      }
      
      toast.error(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, authForm.email);
      toast.success('Password reset email sent! Check your inbox.');
      setAuthMode('login');
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password sign-in is not enabled in Firebase. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else {
        toast.error(error.message || 'Failed to send reset email');
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully!');
      setShowPatientHistory(false);
      setShowAdminPanel(false);
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `prescriptions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Reports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('Reports')
        .getPublicUrl(filePath);

      setPatientDetails(prev => ({ ...prev, prescriptionUrl: publicUrl }));
      toast.success('Prescription uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error.message?.includes('violates row-level security policy')) {
        toast.error('Supabase RLS Error', {
          description: 'To fix this, go to Supabase Dashboard > Storage > Policies and create a policy for "Reports" bucket allowing INSERT for ANON users, or run: CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = \'Reports\');'
        });
      } else {
        toast.error(error.message || 'Failed to upload prescription');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const filteredTests = useMemo(() => {
    return AVAILABLE_TESTS.filter(test => {
      const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          test.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || test.category === selectedCategory;
      const matchesPrice = test.price >= priceRange.min && test.price <= priceRange.max;
      return matchesSearch && matchesCategory && matchesPrice;
    }).sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return 0;
    });
  }, [searchQuery, selectedCategory, priceRange]);

  const toggleTestSelection = (test: LabTest) => {
    setSelectedTests(prev => {
      const isSelected = prev.some(t => t.id === test.id);
      
      // Show search tip on first selection if they haven't searched yet
      if (!isSelected && !hasShownSearchTip && searchQuery === '') {
        setShowSearchTip(true);
        setHasShownSearchTip(true);
        // Hide after 6 seconds
        setTimeout(() => setShowSearchTip(false), 6000);
      }

      if (isSelected) {
        return prev.filter(t => t.id !== test.id);
      } else {
        return [...prev, test];
      }
    });
  };

  const handleBookNow = (test?: LabTest) => {
    if (!user) {
      handleSignIn();
      return;
    }
    
    if (test) {
      // If a specific test is clicked, ensure it's in the selection
      setSelectedTests(prev => {
        const isSelected = prev.some(t => t.id === test.id);
        if (!isSelected) return [...prev, test];
        return prev;
      });
    } else if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }

    setBookingStep('details');
    setIsBookingModalOpen(true);
    setPatientDetails({
      name: userData?.displayName || user.displayName || '',
      phone: userData?.phone || '',
      age: userData?.age || '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00 AM',
      location: userData?.address || '',
      doctorReference: '',
      referralCode: '',
      prescriptionUrl: ''
    });
  };

  const confirmBooking = async () => {
    if (!user || selectedTests.length === 0) return;

    if (!patientDetails.name || !patientDetails.phone || !patientDetails.age || !patientDetails.date || !patientDetails.time || !patientDetails.location) {
      toast.error('Please fill in all required details');
      return;
    }

    setIsBookingInProgress(true);
    try {
      let totalAmount = selectedTests.reduce((sum, test) => sum + test.price, 0);
      
      // Apply promo code logic
      if (patientDetails.referralCode.toUpperCase() === 'FIRST10') {
        totalAmount = Math.round(totalAmount * 0.9);
      } else if (patientDetails.referralCode.toUpperCase() === 'FIRST100') {
        totalAmount = Math.max(0, totalAmount - 100);
      }

      const bookingData = {
        userId: user.uid,
        tests: selectedTests,
        type: bookingType,
        date: patientDetails.date,
        time: patientDetails.time,
        status: 'pending',
        createdAt: Date.now(),
        totalAmount,
        patientName: patientDetails.name,
        patientPhone: patientDetails.phone,
        patientAge: parseInt(patientDetails.age),
        location: patientDetails.location,
        doctorReference: patientDetails.doctorReference,
        referralCode: patientDetails.referralCode,
        prescriptionUrl: patientDetails.prescriptionUrl
      };

      const docRef = await addDoc(collection(db, 'bookings'), bookingData);

      // Update user profile with latest details if they changed
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          phone: patientDetails.phone,
          age: patientDetails.age,
          address: patientDetails.location,
          displayName: patientDetails.name
        }, { merge: true });
      }

      setLastBooking({ ...bookingData, id: docRef.id });
      setBookingStep('confirm');
      setSelectedTests([]);
      toast.success('Booking successful!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
      toast.error('Booking failed. Please try again.');
    } finally {
      setIsBookingInProgress(false);
    }
  };

  const handleAdminUpload = async () => {
    if (!adminUploadForm.bookingId) {
      toast.error('Please select a booking');
      return;
    }

    if (!auth.currentUser) {
      toast.error('You must be logged in to upload reports');
      return;
    }

    setAdminUploadForm(prev => ({ ...prev, isUploading: true }));

    try {
      const booking = allBookings.find(b => b.id === adminUploadForm.bookingId);
      const reports: { [testId: string]: string } = booking?.reports || {};
      
      // Upload all selected files
      for (const [testId, file] of Object.entries(adminUploadForm.files)) {
        if (file) {
          const typedFile = file as File;
          const fileExt = typedFile.name.split('.').pop();
          const fileName = `${adminUploadForm.bookingId}/${testId}_${Date.now()}.${fileExt}`;
          const filePath = `reports/${fileName}`;
          
          setAdminUploadForm(prev => ({ ...prev, uploadProgress: 30 }));
          
          const { error: uploadError } = await supabase.storage
            .from('Reports')
            .upload(filePath, typedFile);
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('Reports')
            .getPublicUrl(filePath);
            
          reports[testId] = publicUrl;
          setAdminUploadForm(prev => ({ ...prev, uploadProgress: 100 }));
        }
      }
      
      // Update booking
      const bookingRef = doc(db, 'bookings', adminUploadForm.bookingId);
      const updateData: any = {
        status: adminUploadForm.status,
        reports: reports,
      };
      
      // For backward compatibility, set reportUrl to the first report if available
      const reportUrls = Object.values(reports);
      if (reportUrls.length > 0) {
        updateData.reportUrl = reportUrls[0];
      }

      if (adminUploadForm.collectionTime) updateData.collectionTime = adminUploadForm.collectionTime;

      await updateDoc(bookingRef, updateData);

      toast.success('Booking updated successfully!');
      setAdminUploadForm({
        patientId: '',
        bookingId: '',
        files: {},
        isUploading: false,
        status: 'pending',
        collectionTime: '',
        uploadProgress: 0
      });
      setShowAdminPanel(false);
    } catch (error: any) {
      console.error('Admin upload error:', error);
      if (error.message?.includes('violates row-level security policy')) {
        toast.error('Supabase RLS Error', {
          description: 'To fix this, go to Supabase Dashboard > Storage > Policies and create a policy for "Reports" bucket allowing INSERT for ANON users, or run: CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = \'Reports\');'
        });
      } else {
        toast.error('An error occurred during update');
      }
      setAdminUploadForm(prev => ({ ...prev, isUploading: false }));
    }
  };

  const closeBooking = () => {
    setIsBookingModalOpen(false);
    setSelectedTests([]);
    setBookingStep('details');
  };

  const combinedHistory = useMemo(() => {
    return userBookings.map(b => ({
      id: b.id,
      testName: b.tests ? b.tests.map(t => t.name).join(', ') : 'Unknown Test',
      date: b.date,
      status: b.status.charAt(0).toUpperCase() + b.status.slice(1),
      createdAt: b.createdAt,
      type: b.status === 'completed' ? 'test' : 'booking',
      bookingType: b.type,
      time: b.time,
      reportUrl: b.reportUrl,
      collectionTime: b.collectionTime,
      reports: b.reports,
      prescriptionUrl: b.prescriptionUrl,
      progress: b.status === 'completed' ? 'Report Download' : 
                b.status === 'in-lab' ? 'In Lab' : 
                b.status === 'sample-collected' ? 'Sample Collected' : 
                'Booking Done'
    })).sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    });
  }, [userBookings]);

  const filteredHistory = useMemo(() => {
    return combinedHistory.filter(item => 
      item.testName.toLowerCase().includes(historySearchQuery.toLowerCase())
    );
  }, [combinedHistory, historySearchQuery]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const PackagesSection = () => (
    <div className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Health Packages</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Choose from our curated health packages designed for comprehensive wellness monitoring and early detection.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {HEALTH_PACKAGES.map((pkg) => (
            <motion.div 
              key={pkg.id}
              whileHover={{ y: -10 }}
              className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col relative"
            >
              {pkg.tag && (
                <div className="absolute top-0 right-0 z-20">
                  <div className="bg-orange-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-lg">
                    {pkg.tag}
                  </div>
                </div>
              )}
              
              <div className={`p-10 bg-gradient-to-br ${pkg.color || 'from-blue-600 to-blue-400'} text-white relative overflow-hidden`}>
                <div className="relative z-10">
                  <p className="text-xs font-bold opacity-80 mb-4 tracking-widest uppercase">{pkg.label || 'HEALTH PACKAGE'}</p>
                  <h3 className="text-3xl font-bold mb-6 leading-tight">{pkg.name}</h3>
                  <div className="flex items-baseline gap-3 mb-4">
                    {pkg.originalPrice && (
                      <span className="text-xl opacity-60 line-through font-medium">₹{pkg.originalPrice}</span>
                    )}
                    <span className="text-5xl font-black tracking-tighter">₹{pkg.price}</span>
                  </div>
                  {pkg.originalPrice && (
                    <div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold">
                      Save ₹{pkg.originalPrice - pkg.price}
                    </div>
                  )}
                </div>
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
              </div>

              <div className="p-10 flex-1 flex flex-col">
                <div className="space-y-4 mb-10">
                  {pkg.testsIncluded.map((test, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={12} className="text-green-500" />
                      </div>
                      <span className="text-slate-700 font-medium text-sm leading-tight">{test}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    const testObj: LabTest = {
                      id: pkg.id,
                      name: pkg.name,
                      price: pkg.price,
                      category: 'Health Package',
                      description: pkg.description
                    };
                    handleBookNow(testObj);
                  }}
                  className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 mt-auto ${
                    pkg.id === 'pkg-1' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' :
                    pkg.id === 'pkg-2' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' :
                    'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                  }`}
                >
                  Book Now
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const BenefitsBanner = () => (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-green-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-green-200">
          <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎉</span>
                <h3 className="text-4xl font-bold leading-tight">Additional Benefits on <br />All Packages</h3>
              </div>
              <div className="grid sm:grid-cols-1 gap-6 mb-8">
                {[
                  'FREE Home Sample Collection',
                  'FREE Report Delivery at your doorstep',
                  '24-Hour Report turnaround time',
                  'Free Doctor Consultation on reports'
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                      <CheckCircle2 size={18} />
                    </div>
                    <span className="text-xl font-bold tracking-tight">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="inline-block bg-yellow-400 text-green-900 px-6 py-3 rounded-2xl font-black text-xl shadow-xl animate-bounce">
                USE CODE: FIRST100 for ₹100 OFF!
              </div>
            </div>
            <div className="text-center lg:text-right">
              <h4 className="text-3xl font-bold mb-8 leading-tight">Don't Miss Out on These Amazing Deals!</h4>
              <button 
                onClick={() => { setCurrentPage('home'); window.location.hash = 'packages'; }}
                className="bg-white text-green-700 px-10 py-5 rounded-3xl font-bold text-xl hover:bg-green-50 transition-all shadow-xl"
              >
                Book Your Package Now
              </button>
              <p className="mt-6 text-green-100/70 text-sm font-medium">*Offers valid till end of month</p>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        </div>
      </div>
    </div>
  );

  const WhyChooseUs = () => (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="space-y-4"
              >
                <div className="rounded-3xl overflow-hidden aspect-[3/4]">
                  <img src="https://images.unsplash.com/photo-1579152276506-5d5ec7ac6372?auto=format&fit=crop&q=80&w=600" alt="Lab 1" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="bg-blue-600 rounded-3xl p-8 text-white">
                  <h4 className="text-3xl font-bold mb-2">100%</h4>
                  <p className="text-blue-100 text-sm">Accuracy Rate</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-4 pt-12"
              >
                <div className="bg-slate-900 rounded-3xl p-8 text-white">
                  <h4 className="text-3xl font-bold mb-2">24/7</h4>
                  <p className="text-slate-400 text-sm">Support Available</p>
                </div>
                <div className="rounded-3xl overflow-hidden aspect-[3/4]">
                  <img src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600" alt="Lab 2" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </motion.div>
            </div>
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-50 rounded-full blur-3xl opacity-50"></div>
          </div>

          <div>
            <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">Why Choose <span className="text-blue-600">Jhansi Labs?</span></h2>
            <p className="text-slate-600 text-lg mb-10 leading-relaxed">
              We combine medical expertise with cutting-edge technology to provide you with the most accurate diagnostic results in the shortest possible time.
            </p>
            
            <div className="space-y-8">
              {[
                { icon: <ShieldCheck className="text-blue-600" />, title: 'Quality Accredited', desc: 'Our laboratory follows international quality standards for testing and calibration.' },
                { icon: <Clock className="text-blue-600" />, title: 'Fast Turnaround', desc: 'Get most of your test reports within 24 hours of sample collection.' },
                { icon: <HomeIcon className="text-blue-600" />, title: 'Home Collection', desc: 'Professional phlebotomists visit your home for safe and painless sample collection.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );



  const PackagesPage = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PackagesSection />
      <BenefitsBanner />
    </motion.div>
  );

  const TermsPage = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="py-20 bg-slate-50 min-h-screen"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Terms & Conditions</h1>
              <p className="text-slate-500">Last updated: April 24, 2026</p>
            </div>
          </div>
          
          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-600 leading-relaxed">
                By accessing or using Jhansi Labs services, you agree to be bound by these Terms and Conditions. Our laboratory provides diagnostic services, home collection, and digital report delivery subject to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Medical Information</h2>
              <p className="text-slate-600 leading-relaxed">
                The reports generated by Jhansi Labs are for diagnostic purposes only. All clinical decisions should be made by a qualified medical professional. Jhansi Labs is not responsible for any interpretation or action taken based on the diagnostic reports without medical consultation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Home Collection Services</h2>
              <p className="text-slate-600 leading-relaxed">
                Home collection services are subject to availability of phlebotomists in your area and the scheduled time slot. While we strive for punctuality, certain factors like traffic or weather may cause delays. If a collection is missed or delayed, we will reschedule at your convenience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Privacy Policy</h2>
              <p className="text-slate-600 leading-relaxed">
                Your medical data and personal information are strictly confidential. We follow strict guidelines and best practices for data security. We do not share your reports with third parties except when required by law or requested by you for medical consultation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Payment and Refunds</h2>
              <p className="text-slate-600 leading-relaxed">
                Payments must be made at the time of booking or during sample collection. Refunds for cancelled bookings will be processed according to our internal policy, typically within 5-7 working days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Contact Information</h2>
              <p className="text-slate-600 leading-relaxed">
                For any queries regarding these terms, please contact us at info@jhansilabs.com or visit our main center.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-12 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <button 
              onClick={() => setCurrentPage('home')}
              className="text-slate-500 font-bold hover:text-blue-600 transition-colors"
            >
              Back to Home
            </button>
            <button 
              onClick={() => { setCurrentPage('tests'); window.scrollTo(0,0); }}
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
            >
              Book My Test Now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const TestsPage = () => (
    <motion.div 
      key="tests"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="py-20 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider mb-6 border border-green-100">
            <Package size={14} />
            Free Sample Collection & Report Delivery
          </div>
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight"
          >
            Available <span className="text-blue-600 relative">
              Lab Tests
              <motion.div 
                className="absolute -bottom-1 left-0 w-full h-1 bg-blue-600/20 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.5, duration: 0.8 }}
              />
            </span>
          </motion.h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Found more than 1000+ tests. Search and book from our wide range of pathology tests.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 mb-10">
          <div className="flex-1 space-y-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-blue-600 text-sm font-bold ml-2 mb-1"
            >
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              Looking for something specific? Search here
            </motion.div>
            <div className="relative group">
              <AnimatePresence>
                {showSearchTip && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    className="absolute -top-16 left-0 right-0 z-50 flex justify-center"
                  >
                    <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-2xl relative">
                      <div className="text-xs font-bold whitespace-nowrap text-center">Can't find your test? Use the search bar! 🔍</div>
                      {/* Arrow Down */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-600 rotate-45" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div 
                className="absolute -inset-[2px] rounded-[18px] bg-gradient-to-r from-emerald-500 via-red-500 to-emerald-500 opacity-75"
                animate={{ 
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  scale: showSearchTip ? [1, 1.02, 1] : 1
                }}
                style={{ backgroundSize: '200% 200%' }}
                transition={{ 
                  backgroundPosition: { duration: 4, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: showSearchTip ? Infinity : 0 }
                }}
              />
              <div className="relative flex items-center bg-white rounded-2xl overflow-hidden">
                <Search className="absolute left-4 text-emerald-500" size={20} />
                <input 
                  type="text" 
                  placeholder="Search for tests (e.g. Blood Test, Diabetes...)"
                  className="w-full pl-12 pr-4 py-4 bg-white border-0 rounded-2xl focus:outline-none focus:ring-0 transition-all placeholder:text-slate-400 font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <motion.div 
                  className="absolute -top-3 -right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 z-10"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                  SEARCH HERE
                </motion.div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {TEST_CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === category 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-72 bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900">Price Range</h4>
              <span className="text-xs font-bold text-blue-600">₹{priceRange.min} - ₹{priceRange.max}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10000" 
              step="100"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-2"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>₹0</span>
              <span>₹10,000+</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTests.map((test) => {
            const isSelected = selectedTests.some(t => t.id === test.id);
            return (
              <motion.div 
                layout
                key={test.id}
                className={`bg-white border rounded-3xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full shadow-lg z-10">
                    <CheckCircle2 size={16} />
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                  }`}>
                    <Stethoscope size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {test.popular && (
                      <span className="text-[10px] font-black text-white bg-orange-600 px-2 py-1 rounded-full uppercase tracking-tighter animate-pulse shadow-sm shadow-orange-200">
                        Popular
                      </span>
                    )}
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                      {test.category}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{test.name}</h3>
                <p className="text-sm text-slate-500 mb-6 line-clamp-2">{test.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Price</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-900">₹{test.price}</span>
                      {test.originalPrice && (
                        <span className="text-xs text-slate-400 line-through">₹{test.originalPrice}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleTestSelection(test)}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        isSelected 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {isSelected ? 'Remove' : 'Select'}
                    </button>
                    {!isSelected && (
                      <button 
                        onClick={() => handleBookNow(test)}
                        className="bg-slate-900 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all"
                      >
                        Book
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredTests.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No tests found</h3>
            <p className="text-slate-500">Try adjusting your search or category filter</p>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
      <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <Toaster position="top-center" richColors />

      {/* Location Access Popup */}
      <AnimatePresence>
        {showLocationPopup && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Jhansi Labs</h3>
              <p className="text-slate-600 mb-6">
                Currently, we are exclusively operating in <strong className="text-blue-600">Jhansi</strong> area only. 
                Enjoy home collection and lab visits within the city!
              </p>
              <button 
                onClick={() => {
                  setShowLocationPopup(false);
                  localStorage.setItem('jhansi_location_notice', 'true');
                }}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Got it, Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mx-auto mb-4">
                    <Microscope size={32} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {authMode === 'login' 
                      ? 'Sign in to book your lab tests' 
                      : authMode === 'signup' 
                        ? 'Join Jhansi Labs for easy health tracking'
                        : 'Enter your email to receive a reset link'}
                  </p>
                </div>


                <form onSubmit={authMode === 'forgot-password' ? handleForgotPassword : handleEmailAuth} className="space-y-4">
                  {authMode === 'signup' && (
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={authForm.name}
                        onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="email" 
                      placeholder="Email Address"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    />
                  </div>
                  {authMode !== 'forgot-password' && (
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Password"
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={authForm.password}
                        onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  )}

                  {authMode === 'login' && (
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setAuthMode('forgot-password')}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  {authMode === 'signup' && (
                    <div className="flex items-start gap-3 mt-2">
                      <div className="relative pt-0.5">
                        <input 
                          type="checkbox" 
                          id="terms"
                          className="peer w-5 h-5 appearance-none border-2 border-slate-200 rounded-lg checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer focus:ring-2 focus:ring-blue-500/20"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                          <CheckCircle2 size={12} strokeWidth={4} />
                        </div>
                      </div>
                      <label htmlFor="terms" className="text-sm text-slate-600 leading-tight cursor-pointer">
                        I agree to the <button type="button" onClick={() => { setShowAuthModal(false); setCurrentPage('terms'); }} className="text-blue-600 font-bold hover:underline">Terms & Conditions</button> and <button type="button" onClick={() => { setShowAuthModal(false); setCurrentPage('terms'); }} className="text-blue-600 font-bold hover:underline">Privacy Policy</button>
                      </label>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAuthSubmitting ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Sign Up' : 'Send Reset Link')}
                  </button>
                </form>

                {authMode !== 'forgot-password' && (
                  <>
                    <div className="relative my-8">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or continue with</span>
                      </div>
                    </div>

                    <button 
                      onClick={handleGoogleSignIn}
                      className="w-full bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                      Google Account
                    </button>
                  </>
                )}

                <p className="text-center mt-8 text-sm text-slate-500">
                  {authMode === 'login' ? "Don't have an account?" : authMode === 'signup' ? "Already have an account?" : "Remembered your password?"}
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="ml-2 text-blue-600 font-bold hover:underline"
                  >
                    {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => { setCurrentPage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
                <Microscope size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">Jhansi <span className="text-blue-600">Labs</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a 
                href={`tel:${LAB_LOCATIONS[0].phone}`}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-all"
              >
                <Phone size={16} />
                Call Now
              </a>
              <button 
                onClick={() => setCurrentPage('home')}
                className={`text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'}`}
              >
                Home
              </button>
              <button 
                onClick={() => setCurrentPage('tests')}
                className={`text-sm font-bold transition-all px-4 py-2 rounded-full relative ${
                  currentPage === 'tests' 
                  ? 'text-white bg-blue-600 shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {currentPage !== 'tests' && (
                  <motion.span 
                    className="absolute inset-0 rounded-full bg-blue-500/20"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                Book a Test
              </button>
              <button 
                onClick={() => setCurrentPage('packages')}
                className={`text-sm font-medium transition-colors ${currentPage === 'packages' ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'}`}
              >
                Packages
              </button>
              {user && (
                <>
                  <button 
                    onClick={() => setShowPatientHistory(true)}
                    className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1"
                  >
                    <FileText size={16} />
                    My History
                  </button>
                  <button 
                    onClick={() => { /* We can reuse auth modal or history modal for profile */ setShowAuthModal(true); setAuthMode('forgot-password'); }}
                    className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1"
                  >
                    <User size={16} />
                    Reset Password
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setShowAdminPanel(true)}
                      className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-lg"
                    >
                      <ShieldCheck size={16} />
                      Admin Panel
                    </button>
                  )}
                </>
              )}
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <User size={16} />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-slate-700">{user.displayName}</span>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                    className="text-slate-600 hover:text-blue-600 px-4 py-2 text-sm font-semibold transition-all"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center gap-2"
                  >
                    <User size={16} />
                    Sign Up
                  </button>
                </div>
              )}
            </div>

            <button className="md:hidden text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 bg-white pt-20 px-4"
          >
            <div className="flex flex-col gap-6 text-center">
              <a 
                href={`tel:${LAB_LOCATIONS[0].phone}`}
                className="flex items-center justify-center gap-2 text-lg font-bold text-blue-600 bg-blue-50 py-4 rounded-2xl"
              >
                <Phone size={20} />
                Call Now
              </a>
              <button 
                onClick={() => { setCurrentPage('home'); setIsMenuOpen(false); }}
                className={`text-lg font-medium ${currentPage === 'home' ? 'text-blue-600' : 'text-slate-900'}`}
              >
                Home
              </button>
              <button 
                onClick={() => { setCurrentPage('tests'); setIsMenuOpen(false); }}
                className={`text-lg font-bold py-3 rounded-2xl relative ${
                  currentPage === 'tests' 
                  ? 'text-white bg-blue-600 shadow-lg shadow-blue-200' 
                  : 'text-slate-900 border border-slate-100 hover:bg-slate-50'
                }`}
              >
                {currentPage !== 'tests' && (
                  <motion.span 
                    className="absolute inset-0 rounded-2xl bg-blue-500/10"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                Book a Test
              </button>
              <button 
                onClick={() => { setCurrentPage('packages'); setIsMenuOpen(false); }}
                className={`text-lg font-medium ${currentPage === 'packages' ? 'text-blue-600' : 'text-slate-900'}`}
              >
                Packages
              </button>
              {user && (
                <>
                  <button 
                    onClick={() => { setIsMenuOpen(false); setShowPatientHistory(true); }}
                    className="text-lg font-medium text-slate-900 flex items-center justify-center gap-2"
                  >
                    <FileText size={20} />
                    My History
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => { setIsMenuOpen(false); setShowAdminPanel(true); }}
                      className="text-lg font-bold text-blue-600 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={20} />
                      Admin Panel
                    </button>
                  )}
                </>
              )}
              {user ? (
                <button 
                  onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                  className="text-lg font-medium text-red-600"
                >
                  Sign Out
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { setIsMenuOpen(false); setAuthMode('login'); setShowAuthModal(true); }}
                    className="border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl text-lg font-semibold hover:bg-slate-50 transition-all"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setIsMenuOpen(false); setAuthMode('signup'); setShowAuthModal(true); }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {currentPage === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Hero Section */}
            <section className="relative pt-12 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
                <ShieldCheck size={14} />
                Quality Accredited Laboratory
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Accurate Results, <br />
                <span className="text-blue-600">Care You Can Trust.</span>
              </h1>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-8 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-200">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-green-800 font-bold">Free Sample Collection & Report Delivery</p>
                  <p className="text-green-600 text-sm">No extra charges for home visits or report delivery</p>
                </div>
              </div>
              <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
                Book pathology tests from the comfort of your home. We offer professional home collection and state-of-the-art lab facilities.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setCurrentPage('tests')}
                  className="bg-green-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-xl shadow-green-200 flex items-center gap-2 group"
                >
                  Book a Test
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <a 
                  href={`tel:${LAB_LOCATIONS[0].phone}`}
                  className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Phone size={20} className="text-blue-600" />
                  Call Now
                </a>
              </div>
              
              <div className="mt-12 grid grid-cols-3 gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-slate-900">500+</span>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Tests Available</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-slate-900">24h</span>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Report Delivery</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-slate-900">10k+</span>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Happy Patients</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl relative z-10">
                <img 
                  src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=1000" 
                  alt="Laboratory" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl z-20 flex items-center gap-4 border border-slate-100">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Home Collection</p>
                  <p className="text-xs text-slate-500">Available in 30 mins</p>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Branch & Office Section */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-600 rounded-[2rem] p-8 lg:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-6">
                  <MapPin size={14} />
                  Main Branch & Office
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">Jhansi Labs Main Center</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1 uppercase tracking-wider">Address</p>
                      <p className="text-lg font-medium">{LAB_LOCATIONS[0].address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1 uppercase tracking-wider">Contact Number</p>
                      <p className="text-2xl font-bold">{LAB_LOCATIONS[0].phone}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 flex flex-wrap gap-4">
                  <a 
                    href={`tel:${LAB_LOCATIONS[0].phone}`}
                    className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <Phone size={20} />
                    Call Now
                  </a>
                  <button 
                    onClick={() => {
                      setBookingType('lab');
                      setPatientDetails(prev => ({ ...prev, location: LAB_LOCATIONS[0].name }));
                      setCurrentPage('tests');
                    }}
                    className="bg-blue-700 text-white border border-blue-500 px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all"
                  >
                    Visit Center
                  </button>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
                  <img 
                    src={LAB_LOCATIONS[0].image} 
                    alt="Main Center"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl text-slate-900 hidden sm:block">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Open Hours</p>
                      <p className="text-sm font-bold">24/7 Available</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Health Packages Section */}
      <PackagesSection />

      {/* Benefits Banner */}
      <BenefitsBanner />

      {/* Why Choose Us Section */}
      <WhyChooseUs />

      {/* Founder Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
              <div className="relative">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src="https://drive.google.com/uc?export=view&id=1xsXh87KAwf34SNPYjHpZeaRBLVn52umq" 
                    alt="Shyam Sundar Singh" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-8 rounded-2xl shadow-xl">
                  <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Founder & CEO</p>
                  <h4 className="text-2xl font-black">Shyam Sundar Singh</h4>
                  <p className="text-xs font-bold opacity-70">Age: 22 Years</p>
                </div>
              </div>
              <div className="lg:pl-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
                  <Award size={14} />
                  Visionary Leadership
                </div>
                <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">A Vision for <span className="text-blue-600">Better Healthcare</span></h2>
                <p className="text-slate-600 text-lg mb-8 leading-relaxed italic">
                  "Our mission at Jhansi Labs is to democratize high-quality diagnostics. We believe that every individual deserves access to accurate, timely, and affordable healthcare services, right at their doorstep."
                </p>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 mb-1">Patient-First Approach</h4>
                      <p className="text-slate-500">Every decision we make is centered around improving the patient experience and health outcomes.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 mb-1">Technological Innovation</h4>
                      <p className="text-slate-500">Leveraging the latest in laboratory technology to ensure 100% accuracy in every report.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">What Our Patients Say</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Trusted by thousands of patients for accurate and timely diagnostic services.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Rahul Mehta', text: 'Very professional staff and the home collection was on time. Reports were delivered within 24 hours.', rating: 5 },
              { name: 'Priya Singh', text: 'The packages are very well priced. I got my full body checkup done and the process was seamless.', rating: 5 },
              { name: 'Amit Verma', text: 'Clean and hygienic lab. The technicians are very skilled and made the blood collection painless.', rating: 4 }
            ].map((review, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => <CheckCircle2 key={i} size={16} className="text-blue-600 fill-blue-600" />)}
                </div>
                <p className="text-slate-600 italic mb-6">"{review.text}"</p>
                <p className="font-bold text-slate-900">- {review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Locations Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Locations</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Visit our main center or any of our collection points for professional diagnostic services.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {LAB_LOCATIONS.map(loc => (
              <motion.div 
                key={loc.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
              >
                <div className="w-full h-48 rounded-2xl overflow-hidden mb-6">
                  <img 
                    src={loc.image} 
                    alt={loc.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{loc.name}</h3>
                  {loc.isMain && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-full">
                      Main Branch
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-3 text-slate-600 mb-4">
                  <MapPin size={18} className="mt-1 flex-shrink-0 text-blue-600" />
                  <p className="text-sm leading-relaxed">{loc.address}</p>
                </div>
                <div className="flex items-center gap-3 text-slate-600 mb-6">
                  <Phone size={18} className="flex-shrink-0 text-blue-600" />
                  <p className="text-sm font-medium">{loc.phone}</p>
                </div>
                <div className="flex gap-3">
                  <a 
                    href={`tel:${loc.phone}`}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Phone size={16} />
                    Call Now
                  </a>
                  <button 
                    onClick={() => {
                      setBookingType('lab');
                      setPatientDetails(prev => ({ ...prev, location: loc.name }));
                      setCurrentPage('tests');
                    }}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    Book Here
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  )}

  {currentPage === 'packages' && PackagesPage()}
  {currentPage === 'tests' && TestsPage()}
  {currentPage === 'terms' && TermsPage()}
</AnimatePresence>

      {/* Floating Selection Bar */}
      <AnimatePresence>
        {selectedTests.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl"
          >
            <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 border border-slate-800">
              <div className="flex items-center gap-4 pl-2">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">{selectedTests.length} Tests Selected</p>
                  <p className="text-xs text-slate-400">Total: ₹{selectedTests.reduce((sum, t) => sum + t.price, 0)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedTests([])}
                  className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
                <button 
                  onClick={() => handleBookNow()}
                  className="bg-green-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                >
                  Book Now
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeBooking}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Book Appointment</h2>
                  <button onClick={closeBooking} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {bookingStep === 'details' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="bg-blue-50 p-4 rounded-2xl mb-6 max-h-[300px] overflow-y-auto no-scrollbar">
                      <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <Stethoscope size={18} />
                        Selected Tests ({selectedTests.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedTests.map(test => (
                          <div key={test.id} className="bg-white/50 p-3 rounded-xl border border-blue-100">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-900 text-sm">{test.name}</h4>
                              <span className="text-sm font-bold text-blue-600">₹{test.price}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{test.description}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-blue-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-900">Total Amount</span>
                        <span className="text-xl font-bold text-blue-600">₹{selectedTests.reduce((sum, t) => sum + t.price, 0)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Estimated Time</p>
                          <p className="text-sm font-bold text-slate-900">Reports in 24 Hours</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setBookingStep('type')}
                      className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                    >
                      Continue to Booking
                      <ChevronRight size={20} />
                    </button>
                  </motion.div>
                )}

                {bookingStep === 'type' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-slate-600 mb-6">Choose how you would like to provide your sample:</p>
                    
                    <div className="grid gap-4 mb-8">
                      <button 
                        onClick={() => setBookingType('home')}
                        className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                          bookingType === 'home' 
                          ? 'border-blue-600 bg-blue-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          bookingType === 'home' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'
                        }`}>
                          <HomeIcon size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">Home Service</p>
                          <p className="text-xs text-slate-500">Expert phlebotomist will visit your home</p>
                        </div>
                        {bookingType === 'home' && <CheckCircle2 className="text-blue-600" size={24} />}
                      </button>

                      <button 
                        onClick={() => setBookingType('lab')}
                        className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                          bookingType === 'lab' 
                          ? 'border-blue-600 bg-blue-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          bookingType === 'lab' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'
                        }`}>
                          <MapPin size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">Lab Visit</p>
                          <p className="text-xs text-slate-500">Visit our nearest collection center</p>
                        </div>
                        {bookingType === 'lab' && <CheckCircle2 className="text-blue-600" size={24} />}
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setBookingStep('details')}
                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setBookingStep('form')}
                        className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                      >
                        Continue to Details
                      </button>
                    </div>
                  </motion.div>
                )}

                {bookingStep === 'form' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-slate-600 mb-6">Please provide patient information for the {bookingType === 'home' ? 'home collection' : 'lab visit'}:</p>
                    
                    <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                      <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200 shadow-sm mb-4">
                        <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex justify-between items-center">
                          <span>Have a Discount Code?</span>
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">Special Offer!</span>
                        </label>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                          <input 
                            type="text" 
                            value={patientDetails.referralCode}
                            onChange={(e) => setPatientDetails({...patientDetails, referralCode: e.target.value})}
                            placeholder="Enter code (e.g. FIRST100)"
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-blue-700 placeholder:text-blue-300 transition-all"
                          />
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest text-center">Apply code to save on your final bill</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient Name</label>
                          <input 
                            type="text" 
                            value={patientDetails.name}
                            onChange={(e) => setPatientDetails({...patientDetails, name: e.target.value})}
                            placeholder="Full Name"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Age</label>
                          <input 
                            type="number" 
                            value={patientDetails.age}
                            onChange={(e) => setPatientDetails({...patientDetails, age: e.target.value})}
                            placeholder="Age"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                          <input 
                            type="tel" 
                            value={patientDetails.phone}
                            onChange={(e) => setPatientDetails({...patientDetails, phone: e.target.value})}
                            placeholder="Contact Number"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preferred Date</label>
                          <input 
                            type="date" 
                            value={patientDetails.date}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setPatientDetails({...patientDetails, date: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preferred Time Slot</label>
                        <select 
                          value={patientDetails.time}
                          onChange={(e) => setPatientDetails({...patientDetails, time: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {['07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'].map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location / Address</label>
                        </div>
                        {bookingType === 'home' ? (
                          <div className="space-y-4">
                            <textarea 
                              value={patientDetails.location}
                              onChange={(e) => setPatientDetails({...patientDetails, location: e.target.value})}
                              placeholder="Full address with landmark"
                              rows={3}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            />
                          </div>
                        ) : (
                          <select 
                            value={patientDetails.location}
                            onChange={(e) => setPatientDetails({...patientDetails, location: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="">Select a Lab Location</option>
                            {LAB_LOCATIONS.map(loc => (
                              <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Doctor Reference (Optional)</label>
                          <input 
                            type="text" 
                            value={patientDetails.doctorReference}
                            onChange={(e) => setPatientDetails({...patientDetails, doctorReference: e.target.value})}
                            placeholder="Doctor's Name"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Prescription (Optional)</label>
                          <div className="relative">
                            <input 
                              type="file" 
                              id="prescription-upload"
                              className="hidden" 
                              accept="image/*,.pdf"
                              onChange={handleFileUpload}
                            />
                            <label 
                              htmlFor="prescription-upload"
                              className={`w-full flex items-center justify-center h-[52px] gap-3 px-4 bg-slate-50 border-2 border-dashed ${patientDetails.prescriptionUrl ? 'border-green-200 bg-green-50' : 'border-slate-200'} rounded-xl cursor-pointer hover:bg-slate-100 transition-all`}
                            >
                              {isUploading ? (
                                <Loader2 className="animate-spin text-blue-600" size={18} />
                              ) : patientDetails.prescriptionUrl ? (
                                <CheckCircle2 className="text-green-600" size={18} />
                              ) : (
                                <Upload className="text-slate-400" size={18} />
                              )}
                              <span className={`text-xs font-bold uppercase tracking-wider ${patientDetails.prescriptionUrl ? 'text-green-600' : 'text-slate-500'}`}>
                                {isUploading ? 'Uploading...' : patientDetails.prescriptionUrl ? 'Uploaded' : 'Upload File'}
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setBookingStep('type')}
                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={confirmBooking}
                        disabled={isBookingInProgress}
                        className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBookingInProgress ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          'Confirm Booking'
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {bookingStep === 'confirm' && lastBooking && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">Booking Confirmed!</h3>
                    <div className="flex items-center justify-center gap-2 mb-6">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Booking ID:</span>
                      <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                        {lastBooking.id || 'GENERATING...'}
                      </span>
                    </div>
                    
                    <p className="text-slate-600 mb-8 text-sm">
                      Your {lastBooking.type === 'home' ? 'home collection' : 'lab visit'} for <strong>{lastBooking.tests.length} tests</strong> has been successfully scheduled. Our team will contact you shortly to confirm the details.
                    </p>

                    {/* Booking Summary */}
                    <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left border border-slate-100 shadow-inner">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Test Summary</h4>
                        <span className="text-[10px] font-bold bg-white text-slate-400 px-2 py-0.5 rounded border border-slate-200">
                          {lastBooking.tests.length} Items
                        </span>
                      </div>
                      <div className="space-y-3 mb-6 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {lastBooking.tests.map((test: any) => (
                          <div key={test.id} className="flex justify-between text-sm items-start gap-4">
                            <span className="text-slate-700 font-medium leading-tight">{test.name}</span>
                            <span className="font-bold text-slate-900 whitespace-nowrap text-right">₹{test.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-slate-300 flex justify-between items-center">
                        <div>
                          <span className="text-sm font-bold text-slate-900">Amount Paid</span>
                          {lastBooking.referralCode && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Tag size={10} className="text-green-600" />
                              <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">CODE: {lastBooking.referralCode}</p>
                            </div>
                          )}
                        </div>
                        <span className="text-2xl font-black text-blue-600">₹{lastBooking.totalAmount}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button 
                         onClick={() => {
                          const receiptText = `Booking Confirmation - Jhansi Labs\n\nBooking ID: ${lastBooking.id}\nPatient: ${lastBooking.patientName}\nTests: ${lastBooking.tests.map((t: any) => t.name).join(', ')}\nTotal: ₹${lastBooking.totalAmount}\nDate: ${lastBooking.date}\nTime: ${lastBooking.time}\nType: ${lastBooking.type === 'home' ? 'Home Collection' : 'Lab Visit'}`;
                          const blob = new Blob([receiptText], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `receipt-${lastBooking.id || Date.now()}.txt`;
                          a.click();
                        }}
                        className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-100"
                      >
                        <Download size={18} />
                        Download PDF Receipt
                      </button>
                      
                      <button 
                        onClick={() => {
                          closeBooking();
                          setShowPatientHistory(true);
                        }}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                      >
                        <History size={18} />
                        View My Booking History
                      </button>
                      
                      <button 
                        onClick={closeBooking}
                        className="w-full text-slate-400 py-2 text-xs font-bold hover:text-slate-600 transition-all uppercase tracking-widest"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Patient History Modal */}
      <AnimatePresence>
        {showPatientHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPatientHistory(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Patient History</h2>
                    <p className="text-xs text-slate-500">View and download your medical reports</p>
                  </div>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search tests..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                  />
                </div>
                
                <button onClick={() => setShowPatientHistory(false)} className="absolute top-4 right-4 sm:static p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 no-scrollbar bg-slate-50/30">
                {combinedHistory.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-200">
                      <FileText size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No history found</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mb-8">You haven't booked any tests yet. Book a home collection to get started.</p>
                    <button 
                      onClick={() => { setShowPatientHistory(false); setCurrentPage('tests'); }}
                      className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 mx-auto"
                    >
                      Book a Test
                      <ArrowRight size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {combinedHistory.map((item) => (
                      <motion.div 
                        layout
                        key={item.id} 
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              item.status === 'Completed' ? 'bg-blue-50 text-blue-600' : 
                              item.status === 'Cancelled' ? 'bg-red-50 text-red-600' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                              {item.type === 'booking' ? <Calendar size={24} /> : <FileText size={24} />}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                {item.testName}
                                {item.status === 'Completed' && <CheckCircle2 size={16} className="text-green-500" />}
                              </h4>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                  <Calendar size={14} />
                                  {item.date} {item.type === 'booking' && `at ${(item as any).time}`}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  item.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                  item.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-200 text-slate-600'
                                }`}>
                                  {item.status}
                                </span>
                                {item.type === 'booking' && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {(item as any).bookingType === 'home' ? 'Home' : 'Lab'}
                                  </span>
                                )}
                                {item.prescriptionUrl && (
                                  <a 
                                    href={item.prescriptionUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 hover:bg-orange-200 transition-colors"
                                  >
                                    <FileText size={10} />
                                    Prescription
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 max-w-md">
                            {item.status !== 'Completed' ? (
                              <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  <span className={(item as any).progress === 'Booking Done' ? 'text-blue-600' : ''}>Booking Done</span>
                                  <span className={(item as any).progress === 'Sample Collected' ? 'text-blue-600' : ''}>Sample Collected</span>
                                  <span className={(item as any).progress === 'In Lab' ? 'text-blue-600' : ''}>In Lab</span>
                                  <span className={(item as any).progress === 'Report Download' ? 'text-blue-600' : ''}>Report</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ 
                                      width: (item as any).progress === 'Sample Collected' ? '50%' : 
                                             (item as any).progress === 'In Lab' ? '75%' : 
                                             (item as any).progress === 'Report Download' ? '100%' : '25%' 
                                    }}
                                    className="h-full bg-blue-600 rounded-full"
                                  />
                                </div>
                                <p className="text-xs text-blue-600 font-medium text-center">
                                  {(item as any).progress === 'Sample Collected' && (item as any).collectionTime ? 
                                    `Sample Collected at ${(item as any).collectionTime}` : 
                                    ((item as any).progress || 'Processing...')}
                                </p>
                              </div>
                            ) : (
                              item.reports && Object.keys(item.reports).length > 0 ? (
                                <div className="flex flex-wrap gap-3 lg:justify-end">
                                  {Object.entries(item.reports).map(([testId, url]) => {
                                    const test = allBookings.find(b => b.id === item.id)?.tests?.find((t: any) => t.id === testId);
                                    return (
                                      <div key={testId} className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{test?.name || 'Report'}</span>
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => setSelectedReport({ ...item, reportUrl: url as string } as any)}
                                            className="p-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all flex items-center gap-2"
                                            title="Quick View"
                                          >
                                            <Eye size={16} />
                                          </button>
                                          <a 
                                            href={url as string} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
                                            title="Download"
                                          >
                                            <Download size={16} />
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-3 lg:justify-end">
                                  <button 
                                    onClick={() => setSelectedReport(item as any)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all flex items-center gap-2"
                                  >
                                    <Eye size={16} />
                                    Quick View
                                  </button>
                                  <a 
                                    href={(item as any).reportUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
                                  >
                                    <Download size={16} />
                                    Download Report
                                  </a>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedReport.testName}</h3>
                    <p className="text-xs text-slate-500">Report Date: {selectedReport.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={selectedReport.reportUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Open in new tab"
                  >
                    <ArrowUpRight size={20} />
                  </a>
                  <button 
                    onClick={() => setSelectedReport(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-100 p-4 sm:p-8 overflow-hidden">
                <div className="w-full h-full bg-white rounded-2xl shadow-inner overflow-hidden relative">
                  <iframe 
                    src={`${selectedReport.reportUrl}#toolbar=0`} 
                    className="w-full h-full border-none"
                    title="Medical Report"
                  />
                  {/* Overlay to prevent some interactions if needed, or just for styling */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400" />
                </div>
              </div>
              
              <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400 font-medium">
                  Report ID: {selectedReport.id} | Securely served by Jhansi Labs
                </p>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPanel(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Admin Upload Panel</h2>
                    <p className="text-xs text-slate-500">Upload reports and update booking status</p>
                  </div>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 no-scrollbar bg-slate-50">
                <div className="space-y-8">
                  {/* Recent Bookings List */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Recent Bookings</h3>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{allBookings.length} Total</span>
                    </div>
                    <div className="space-y-3">
                      {allBookings.slice(0, 10).map((booking) => {
                        const isNew = (Date.now() - (booking.createdAt || 0)) < 24 * 60 * 60 * 1000;
                        const isSelected = adminUploadForm.bookingId === booking.id;
                        return (
                          <div 
                            key={booking.id} 
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                              : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'
                            }`}
                            onClick={() => {
                              setAdminUploadForm(prev => ({ 
                                ...prev, 
                                patientId: booking.userId,
                                bookingId: booking.id,
                                testName: booking.tests?.[0]?.name || '',
                                status: booking.status || 'pending',
                                collectionTime: booking.collectionTime || ''
                              }));
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                  {booking.patientName}
                                </span>
                                {isNew && (
                                  <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">NEW</span>
                                )}
                              </div>
                              <span className={`text-xs font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                {booking.date}
                              </span>
                            </div>
                            
                            {isSelected && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mb-4 pt-4 border-t border-blue-500/30 space-y-3"
                              >
                                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-widest font-bold">
                                  <div>
                                    <span className="text-blue-200 block mb-1">Patient Info</span>
                                    <p className="text-white">Age: {booking.patientAge} | {booking.patientPhone}</p>
                                  </div>
                                  <div>
                                    <span className="text-blue-200 block mb-1">Billing</span>
                                    <p className="text-white">Total: ₹{booking.totalAmount}</p>
                                    {booking.referralCode && <p className="text-yellow-300">Code: {booking.referralCode}</p>}
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-blue-200 block mb-1">Location</span>
                                    <p className="text-white">{booking.location}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            <div className="flex justify-between items-center">
                              <p className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                {booking.tests?.[0]?.name} {booking.tests?.length > 1 ? `(+${booking.tests.length - 1})` : ''}
                              </p>
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${
                                booking.status === 'completed' 
                                ? 'bg-green-100 text-green-700' 
                                : booking.status === 'pending'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-slate-200" />

                  {/* Quick Action Form */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Update Booking Status</h3>
                    <div className="space-y-6">
                      {/* Select Patient */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Patient</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={adminUploadForm.patientId}
                          onChange={(e) => {
                            const patientId = e.target.value;
                            setAdminUploadForm(prev => ({ ...prev, patientId, bookingId: '' }));
                          }}
                        >
                          <option value="">Select a patient</option>
                          {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
                          ))}
                        </select>
                      </div>

                      {/* Select Booking */}
                      {adminUploadForm.patientId && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Booking</label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={adminUploadForm.bookingId}
                            onChange={(e) => {
                              const bookingId = e.target.value;
                              const booking = allBookings.find(b => b.id === bookingId);
                              setAdminUploadForm(prev => ({ 
                                ...prev, 
                                bookingId,
                                testName: booking?.tests?.[0]?.name || '',
                                status: booking?.status || 'pending',
                                collectionTime: booking?.collectionTime || ''
                              }));
                            }}
                          >
                            <option value="">Select a pending booking</option>
                            {allBookings
                              .filter(b => b.userId === adminUploadForm.patientId && b.status !== 'completed')
                              .map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.date} - {b.tests?.[0]?.name} {b.tests?.length > 1 ? `(+${b.tests.length - 1})` : ''}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      )}

                  {/* Update Status */}
                  {adminUploadForm.bookingId && (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Update Status</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={adminUploadForm.status}
                          onChange={(e) => setAdminUploadForm(prev => ({ ...prev, status: e.target.value as BookingStatus }))}
                        >
                          <option value="pending">Booking Done</option>
                          <option value="sample-collected">Sample Collected</option>
                          <option value="in-lab">In Lab</option>
                          <option value="completed">Completed (Upload Report)</option>
                        </select>
                      </div>

                      {adminUploadForm.status === 'sample-collected' && (
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Collection Time</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 10:30 AM"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={adminUploadForm.collectionTime}
                            onChange={(e) => setAdminUploadForm(prev => ({ ...prev, collectionTime: e.target.value }))}
                          />
                        </div>
                      )}

                      {/* Reports Section */}
                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Upload Reports (Optional)</label>
                        {allBookings.find(b => b.id === adminUploadForm.bookingId)?.tests?.map((test: any) => (
                          <div key={test.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-slate-700">{test.name}</span>
                              {allBookings.find(b => b.id === adminUploadForm.bookingId)?.reports?.[test.id] && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Already Uploaded</span>
                              )}
                            </div>
                            <div className="relative">
                              <input 
                                type="file" 
                                accept="application/pdf"
                                className="hidden"
                                id={`report-upload-${test.id}`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setAdminUploadForm(prev => ({
                                    ...prev,
                                    files: { ...prev.files, [test.id]: file }
                                  }));
                                }}
                              />
                              <label 
                                htmlFor={`report-upload-${test.id}`}
                                className="flex items-center justify-center gap-2 w-full px-4 py-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
                              >
                                {adminUploadForm.files[test.id] ? (
                                  <div className="flex items-center gap-2 text-blue-600 font-bold text-sm truncate">
                                    <FileText size={16} />
                                    {adminUploadForm.files[test.id]?.name}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                                    <Upload size={16} />
                                    <span>Select report for {test.name}</span>
                                  </div>
                                )}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {adminUploadForm.isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-blue-600 uppercase tracking-widest">
                        <span>Uploading...</span>
                        <span>{Math.round(adminUploadForm.uploadProgress)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${adminUploadForm.uploadProgress}%` }}
                          className="h-full bg-blue-600 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleAdminUpload}
                    disabled={adminUploadForm.isUploading}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {adminUploadForm.isUploading ? <Loader2 className="animate-spin" size={20} /> : 'Update Booking & Status'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div 
                className="flex items-center gap-2 mb-6 cursor-pointer group"
                onClick={() => { setCurrentPage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <Microscope size={24} />
                </div>
                <span className="text-2xl font-bold tracking-tight">Jhansi <span className="text-blue-600">Labs</span></span>
              </div>
              <p className="text-slate-400 max-w-sm mb-8 leading-relaxed">
                Your trusted partner in health diagnostics. Providing accurate, timely, and affordable laboratory services.
              </p>
              <div className="flex gap-4">
                <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all">
                  <ExternalLink size={18} />
                </button>
                <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all">
                  <Mail size={18} />
                </button>
                <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all">
                  <Phone size={18} />
                </button>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-6">Quick Links</h4>
              <ul className="space-y-4 text-slate-400">
                <li><button onClick={() => setCurrentPage('home')} className="hover:text-blue-600 transition-colors">Home</button></li>
                <li><button onClick={() => setCurrentPage('packages')} className="hover:text-blue-600 transition-colors">Packages</button></li>
                <li><button onClick={() => { setCurrentPage('terms'); window.scrollTo(0,0); }} className="hover:text-blue-600 transition-colors">Terms & Conditions</button></li>
                <li><button onClick={() => { setCurrentPage('terms'); window.scrollTo(0,0); }} className="hover:text-blue-600 transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-6">Contact Us</h4>
              <ul className="space-y-4 text-slate-400">
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-blue-600 shrink-0 mt-1" />
                  <span>{LAB_LOCATIONS[0].address}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-blue-600 shrink-0" />
                  <a href={`tel:${LAB_LOCATIONS[0].phone}`} className="hover:text-blue-600 transition-colors font-bold text-white">
                    {LAB_LOCATIONS[0].phone} (Call Now)
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-blue-600 shrink-0" />
                  <span>info@jhansilabs.com</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center text-slate-500 text-sm">
            <p>&copy; 2026 Jhansi Labs. All rights reserved.</p>
          </div>
        </div>
      </footer>
        </div>
    );
}
