import type { FrameworkContext } from "../../types/framework-context.type";
import type { ModelParameters } from "../../types/provider.type";
import type { ProviderRequestContext } from "../../types/provider-request-context.type";
import { providerCompatibilityKey } from "../context-keys";

export function createProviderRequestContext(
  frameworkContext: FrameworkContext,
  input: {
    modelId: string;
    modelParameters?: ModelParameters;
  }
): ProviderRequestContext {
  const compatibility = frameworkContext.getOptional(providerCompatibilityKey);

  return compatibility
    ? {
        ...input,
        compatibility,
      }
    : input;
}
