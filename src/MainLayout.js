// src/layouts/MainLayout.js (ou src/MainLayout.js selon ton arborescence)
import { useLocation, Outlet } from 'react-router-dom';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import NavigationBar from './components/NavigationBar';
import ScrollRestorer from './components/ScrollRestorer';

const MainLayout = () => {
  const location = useLocation();

  return (
    <div className="pb-5" style={{ position: 'relative', overflow: 'hidden', height: '100vh' }}>
      <ScrollRestorer />
      <SwitchTransition>
        <CSSTransition key={location.pathname} classNames="page" timeout={300}>
          <div style={{ position: 'absolute', width: '100%', left: 0, top: 0, bottom: 0, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </CSSTransition>
      </SwitchTransition>
      <NavigationBar />
    </div>
  );
};

export default MainLayout;
