// Navigation Integration Tests for Community Posts
// Tests navigation between posts and existing features, notification badge updates, and responsive design
// Requirements: Integration testing

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../contexts/AuthContext';
import { Navbar } from '../../../components/Navbar';
import CommunityView from '../../../components/community/CommunityView';
import UnifiedNotificationBadge from '../../../components/UnifiedNotificationBadge';

// Mock Firebase
vi.mock('../../../firebase.config', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' }
  },
  database: {}
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  updateProfile: vi.fn()
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  push: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn()
}));

// Mock services
vi.mock('../../../services/notificationService', () => ({
  listenToNotifications: vi.fn(() => vi.fn()),
  Notification: {}
}));

vi.mock('../../../services/communityNotificationService', () => ({
  communityNotificationService: {
    listenToNotifications: vi.fn(() => vi.fn())
  }
}));

vi.mock('../../../services/notificationPreferencesService', () => ({
  notificationPreferencesService: {
    updateLastActive: vi.fn()
  }
}));

vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { uid: 'test-user-id', displayName: 'Test User' },
    needsOnboarding: false,
    setNeedsOnboarding: vi.fn()
  })
}));

vi.mock('../../../services/postService', () => ({
  postService: {
    getFeedPosts: vi.fn().mockResolvedValue([]),
    listenToPosts: vi.fn(() => vi.fn())
  }
}));

// Mock components that have complex dependencies
vi.mock('../../../components/community/CommunityFeed', () => ({
  default: ({ onCreatePost }: { onCreatePost: () => void }) => (
    <div data-testid="community-feed">
      <button onClick={onCreatePost} data-testid="create-post-btn">
        Create Post
      </button>
    </div>
  )
}));

vi.mock('../../../components/community/TrendingSidebar', () => ({
  default: () => <div data-testid="trending-sidebar">Trending</div>
}));

vi.mock('../../../components/community/PostCreator', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="post-creator">
      <button onClick={onCancel} data-testid="cancel-post">Cancel</button>
    </div>
  )
}));

vi.mock('../../../components/community/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>
}));

vi.mock('../../../components/NotificationsPanel', () => ({
  default: () => <div data-testid="notifications-panel">Chat Notifications</div>
}));

const renderWithAuth = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

describe('Navigation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navbar Navigation', () => {
    it('should render navigation tabs correctly', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      // Check that navigation tabs are present
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
    });

    it('should highlight active navigation tab', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'community' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      const communityTab = screen.getByText('Community').closest('button');
      expect(communityTab).toHaveClass('bg-nexus-accent/20');
    });

    it('should call onOpenCommunity when Community tab is clicked', () => {
      const mockOnOpenCommunity = vi.fn();
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: mockOnOpenCommunity,
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      fireEvent.click(screen.getByText('Community'));
      expect(mockOnOpenCommunity).toHaveBeenCalledTimes(1);
    });

    it('should show create post button only in community view', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      const { rerender } = renderWithAuth(<Navbar {...mockProps} />);

      // Should not show create post button in products view
      expect(screen.queryByText('Create Post')).not.toBeInTheDocument();

      // Should show create post button in community view
      rerender(
        <AuthProvider>
          <Navbar {...mockProps} currentView="community" />
        </AuthProvider>
      );

      expect(screen.getByText('Create Post')).toBeInTheDocument();
    });

    it('should call onCreatePost when create post button is clicked', () => {
      const mockOnCreatePost = vi.fn();
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: mockOnCreatePost,
        currentView: 'community' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      fireEvent.click(screen.getByText('Create Post'));
      expect(mockOnCreatePost).toHaveBeenCalledTimes(1);
    });
  });

  describe('Community View Integration', () => {
    it('should render community feed and sidebar', () => {
      renderWithAuth(<CommunityView />);

      expect(screen.getByTestId('community-feed')).toBeInTheDocument();
      expect(screen.getByTestId('trending-sidebar')).toBeInTheDocument();
    });

    it('should open post creator when create post is clicked', async () => {
      renderWithAuth(<CommunityView />);

      // Click create post button in feed
      fireEvent.click(screen.getByTestId('create-post-btn'));

      // Should show post creator modal
      await waitFor(() => {
        expect(screen.getByTestId('post-creator')).toBeInTheDocument();
      });
    });

    it('should close post creator when cancel is clicked', async () => {
      renderWithAuth(<CommunityView />);

      // Open post creator
      fireEvent.click(screen.getByTestId('create-post-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('post-creator')).toBeInTheDocument();
      });

      // Close post creator
      fireEvent.click(screen.getByTestId('cancel-post'));
      await waitFor(() => {
        expect(screen.queryByTestId('post-creator')).not.toBeInTheDocument();
      });
    });
  });

  describe('Unified Notification Badge', () => {
    it('should render notification badge', () => {
      renderWithAuth(<UnifiedNotificationBadge />);

      const bellIcon = screen.getByRole('button');
      expect(bellIcon).toBeInTheDocument();
    });

    it('should show notification panel when clicked', async () => {
      renderWithAuth(<UnifiedNotificationBadge />);

      const bellButton = screen.getByRole('button');
      fireEvent.click(bellButton);

      await waitFor(() => {
        // Use a more specific selector to avoid multiple matches
        expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      });
    });

    it('should show both community and chat tabs', async () => {
      renderWithAuth(<UnifiedNotificationBadge />);

      const bellButton = screen.getByRole('button');
      fireEvent.click(bellButton);

      await waitFor(() => {
        expect(screen.getByText('Community')).toBeInTheDocument();
        expect(screen.getByText('Chat')).toBeInTheDocument();
      });
    });

    it('should switch between notification tabs', async () => {
      renderWithAuth(<UnifiedNotificationBadge />);

      const bellButton = screen.getByRole('button');
      fireEvent.click(bellButton);

      await waitFor(() => {
        const communityTab = screen.getByText('Community');
        const chatTab = screen.getByText('Chat');
        
        expect(communityTab).toBeInTheDocument();
        expect(chatTab).toBeInTheDocument();

        // Click chat tab
        fireEvent.click(chatTab);
        
        // Should show chat notifications
        expect(screen.getByTestId('notifications-panel')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should hide navigation tabs on mobile screens', () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      // Navigation tabs should have hidden class on mobile
      const navTabs = screen.getByText('Products').closest('div');
      expect(navTabs).toHaveClass('hidden', 'md:flex');
    });

    it('should show create post icon only on mobile in community view', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'community' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      // Create post text should be hidden on small screens
      const createPostText = screen.getByText('Create Post');
      expect(createPostText).toHaveClass('hidden', 'sm:inline');
    });

    it('should maintain consistent styling across views', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      const { rerender } = renderWithAuth(<Navbar {...mockProps} />);

      // Check navbar styling in products view
      const navbar = screen.getByRole('navigation');
      expect(navbar).toHaveClass('sticky', 'top-0', 'z-50');

      // Switch to community view
      rerender(
        <AuthProvider>
          <Navbar {...mockProps} currentView="community" />
        </AuthProvider>
      );

      // Navbar should maintain same styling
      expect(navbar).toHaveClass('sticky', 'top-0', 'z-50');
    });
  });

  describe('Navigation State Management', () => {
    it('should maintain navigation state when switching views', () => {
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: vi.fn(),
        onOpenPCBuilder: vi.fn(),
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'products' as const
      };

      const { rerender } = renderWithAuth(<Navbar {...mockProps} />);

      // Products tab should be active
      const productsTab = screen.getByText('Products').closest('button');
      expect(productsTab).toHaveClass('bg-nexus-accent/20');

      // Switch to community view
      rerender(
        <AuthProvider>
          <Navbar {...mockProps} currentView="community" />
        </AuthProvider>
      );

      // Community tab should now be active
      const communityTab = screen.getByText('Community').closest('button');
      expect(communityTab).toHaveClass('bg-nexus-accent/20');
    });

    it('should handle navigation between existing features', () => {
      const mockOnOpenPCBuilder = vi.fn();
      const mockOnOpenFavorites = vi.fn();
      
      const mockProps = {
        onSearch: vi.fn(),
        isLoading: false,
        isDarkMode: true,
        onToggleTheme: vi.fn(),
        onOpenFavorites: mockOnOpenFavorites,
        onOpenPCBuilder: mockOnOpenPCBuilder,
        onOpenCommunity: vi.fn(),
        onCreatePost: vi.fn(),
        currentView: 'community' as const
      };

      renderWithAuth(<Navbar {...mockProps} />);

      // Test PC Builder navigation
      const pcBuilderButton = screen.getByLabelText('Open PC Builder');
      fireEvent.click(pcBuilderButton);
      expect(mockOnOpenPCBuilder).toHaveBeenCalledTimes(1);

      // Test Favorites navigation
      const favoritesButton = screen.getByLabelText('Open favorites');
      fireEvent.click(favoritesButton);
      expect(mockOnOpenFavorites).toHaveBeenCalledTimes(1);
    });
  });
});