import type { SubscriptionSummary } from "#/types/billing.type";

export function getCurrentSubscription(): SubscriptionSummary {
	return {
		id: "local-subscription",
		status: "inactive",
		planId: "local-free",
	};
}
