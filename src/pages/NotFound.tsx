import { useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * Not Found page configuration
 * Contains error messages and navigation routes
 */
const NOT_FOUND_CONFIG = {
  ERROR: {
    STATUS_CODE: 404,
    TITLE: 'Page not found',
    MESSAGE: 'Oops! Page not found',
  },
  ROUTES: {
    HOME: '/',
  },
};

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(`${NOT_FOUND_CONFIG.ERROR.STATUS_CODE} Error: User attempted to access non-existent route:`, location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{NOT_FOUND_CONFIG.ERROR.STATUS_CODE}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{NOT_FOUND_CONFIG.ERROR.MESSAGE}</p>
        <a href={NOT_FOUND_CONFIG.ROUTES.HOME} className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
