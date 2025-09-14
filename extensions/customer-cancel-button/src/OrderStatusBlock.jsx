import {
  reactExtension,
  Button,
  useApi,
  useSessionToken
} from "@shopify/ui-extensions-react/customer-account";
import { useState } from "react";

export default reactExtension(
  "customer-account.order.action.menu-item.render",
  () => <CancelOrderButton />
);

function CancelOrderButton() {
  const { i18n, ui, orderId } = useApi();
  const sessionToken = useSessionToken();
  const [isLoading, setIsLoading] = useState(false);

  // For this target, we get orderId directly from the API
  // We'll need to fetch order details to check if it's already cancelled

  const handleCancelOrder = async () => {
    setIsLoading(true);

    try {
      const token = await sessionToken.get();

      const response = await fetch('https://england-instrumental-course-nirvana.trycloudflare.com/api/customer/cancel-order', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        ui.toast.show(i18n.translate('order.cancelled.success', 'Order cancelled successfully'));
        // Reload the page to reflect the cancelled status
        window.location.reload();
      } else {
        ui.toast.show(result.error || i18n.translate('order.cancelled.error', 'Failed to cancel order'), {
          kind: 'error'
        });
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      ui.toast.show(i18n.translate('order.cancelled.error', 'Failed to cancel order'), {
        kind: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      loading={isLoading}
      onPress={handleCancelOrder}
      kind="secondary"
    >
      {i18n.translate('order.cancel', 'Cancel Order')}
    </Button>
  );
}
