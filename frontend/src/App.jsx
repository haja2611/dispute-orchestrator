import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import CreateDisputeForm from './components/CreateDisputeForm.jsx'
import DisputeList       from './components/DisputeList.jsx'
import DisputeDetail     from './components/DisputeDetail.jsx'
import DbHealth          from './components/DbHealth.jsx'

const NAV_LINKS = [
  { to: '/',        label: 'Disputes',      exact: true },
  { to: '/create',  label: 'New Dispute'              },
  { to: '/health',  label: 'DB Health'                },
]

function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-bold text-lg gradient-text">DisputeOS</span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 page-enter">
          <Routes>
            <Route path="/"             element={<DisputeList />} />
            <Route path="/create"       element={<CreateDisputeForm />} />
            <Route path="/disputes/:id" element={<DisputeDetail />} />
            <Route path="/health"       element={<DbHealth />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
