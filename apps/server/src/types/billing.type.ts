export interface SubscriptionSummary {
	id: string;
	status: "inactive" | "active" | "past_due" | "canceled";
	planId: string;
}
