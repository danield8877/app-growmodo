import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ScrollToTop from './components/ScrollToTop';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleDisabled from './pages/ModuleDisabled';
import RevamperDashboard from './pages/revamper/RevamperDashboard';
import RevamperNew from './pages/revamper/RevamperNew';
import RevamperResult from './pages/revamper/RevamperResult';
import RevamperEditor from './pages/revamper/RevamperEditor';
import RevamperPublic from './pages/revamper/RevamperPublic';
import ImagerDashboard from './pages/imager/ImagerDashboard';
import ImagerNew from './pages/imager/ImagerNew';
import ImagerResult from './pages/imager/ImagerResult';
import EmailerDashboard from './pages/emailer/EmailerDashboard';
import EmailerNew from './pages/emailer/EmailerNew';
import EmailerCampaign from './pages/emailer/EmailerCampaign';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/revamper/public/:id" element={<RevamperPublic />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/projects/*" element={<ProtectedRoute><ModuleDisabled /></ProtectedRoute>} />
            <Route path="/tasks/*" element={<ProtectedRoute><ModuleDisabled /></ProtectedRoute>} />
            <Route path="/invoicer/*" element={<ProtectedRoute><ModuleDisabled /></ProtectedRoute>} />
            <Route path="/super-admin" element={<ProtectedRoute><ModuleDisabled /></ProtectedRoute>} />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/revamper"
              element={
                <ProtectedRoute allowGuest>
                  <RevamperDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/revamper/new"
              element={
                <ProtectedRoute allowGuest>
                  <RevamperNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/revamper/result/:id"
              element={
                <ProtectedRoute allowGuest>
                  <RevamperResult />
                </ProtectedRoute>
              }
            />
            <Route
              path="/revamper/edit/:id"
              element={
                <ProtectedRoute allowGuest>
                  <RevamperEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imager"
              element={
                <ProtectedRoute allowGuest>
                  <ImagerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imager/new"
              element={
                <ProtectedRoute allowGuest>
                  <ImagerNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imager/:projectId"
              element={
                <ProtectedRoute allowGuest>
                  <ImagerResult />
                </ProtectedRoute>
              }
            />

            <Route
              path="/emailer"
              element={
                <ProtectedRoute>
                  <EmailerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/emailer/new"
              element={
                <ProtectedRoute>
                  <EmailerNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/emailer/:id"
              element={
                <ProtectedRoute>
                  <EmailerCampaign />
                </ProtectedRoute>
              }
            />

            <Route path="/404" element={<NotFound />} />
            <Route path="/devis/partage/:token" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
