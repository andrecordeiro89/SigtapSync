import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './components/index.css'
import { LEAN_MODE } from './config/system'

if (!LEAN_MODE) {
  await import('./config/doctorPaymentRules/preload')
}

createRoot(document.getElementById("root")!).render(<App />);
