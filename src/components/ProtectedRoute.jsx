import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Пускает дальше только авторизованных, а с role — только нужную роль.
 *
 * Это удобство интерфейса, а не защита: настоящая проверка прав живёт
 * на бэкенде, обойти её через DevTools нельзя.
 */
export function ProtectedRoute({ children, role }) {
  const { token, user } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/scans" replace />;

  return children;
}
