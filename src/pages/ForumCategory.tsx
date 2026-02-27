import { Navigate, useParams } from "react-router-dom";

// ForumCategory just redirects to Forum with category param
const ForumCategory = () => {
  const { categorySlug } = useParams();
  return <Navigate to={`/forum?category=${categorySlug}`} replace />;
};

export default ForumCategory;
