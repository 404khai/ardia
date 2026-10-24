import { requireOptionalNativeModule } from "expo-modules-core";

export type BriefProviderStatus = { connected: boolean; email: string; subject: string };

type BriefsNative = {
  beginChatGPTSignIn(): Promise<{ authorizationUrl: string }>;
  completeChatGPTSignIn(): Promise<BriefProviderStatus>;
  cancelChatGPTSignIn(): Promise<void>;
  briefProviderStatus(): Promise<BriefProviderStatus>;
  disconnectChatGPT(): Promise<boolean>;
  cancelDailyBriefGeneration(): Promise<void>;
  generateDailyBrief(context: string): Promise<string>;
};

const native = () => {
  const module = requireOptionalNativeModule<BriefsNative>("ArdiaBriefs");
  if (!module) throw new Error("This build needs an update before ChatGPT can connect.");
  return module;
};

export async function connectChatGPT(openAuthorization: (url: string) => void | Promise<void>): Promise<BriefProviderStatus> {
  const module = native();
  const { authorizationUrl } = await module.beginChatGPTSignIn();
  try {
    await openAuthorization(authorizationUrl);
    return await module.completeChatGPTSignIn();
  } catch (error) {
    await module.cancelChatGPTSignIn();
    throw error;
  }
}

export const cancelChatGPTSignIn = () => native().cancelChatGPTSignIn();
export const briefProviderStatus = () => native().briefProviderStatus();
export const disconnectChatGPT = () => native().disconnectChatGPT();
export const generateDailyBrief = (contextJSON: string) => native().generateDailyBrief(contextJSON);

export const cancelDailyBriefGeneration = () => native().cancelDailyBriefGeneration();
