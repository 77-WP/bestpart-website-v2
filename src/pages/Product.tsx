import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/** Legacy route /order/:itemId — redirect to /order?item=:itemId */
export default function Product() {
  const { itemId } = useParams();
  const navigate   = useNavigate();

  useEffect(() => {
    navigate(`/order${itemId ? `?item=${itemId}` : ''}`, { replace: true });
  }, [itemId, navigate]);

  return null;
}
