import type { UserSummary } from "#/types/user.type";

export function getCurrentUser(): UserSummary {
	return {
		id: "local-user",
		displayName: "Local User",
	};
}
