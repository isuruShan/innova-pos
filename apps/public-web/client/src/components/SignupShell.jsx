import Navbar from './Navbar';
import Footer from './Footer';

/** Same chrome as landing / merchant guide — fixed nav + footer. */
export default function SignupShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">{children}</main>
      <Footer />
    </div>
  );
}
