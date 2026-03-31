const Footer = () => {
  return (
    <footer className="mt-8 border-t border-white/10 bg-glik-primary">
      <div className="container-app py-4 text-center text-xs text-purple-100/90">
        © {new Date().getFullYear()} GLIK | Validación logística documental
      </div>
    </footer>
  );
};

export default Footer;
