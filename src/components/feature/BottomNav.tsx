import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/create', label: 'Create', icon: 'ri-add-circle-line' },
  { path: '/plan', label: 'Plan', icon: 'ri-calendar-check-line' },
  { path: '/dashboard', label: 'Dashboard', icon: 'ri-bar-chart-2-line' },
  { path: '/feedback', label: 'Feedback', icon: 'ri-star-smile-line' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-area-pb">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-violet-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${item.icon} text-xl`} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-violet-600' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-violet-600 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
