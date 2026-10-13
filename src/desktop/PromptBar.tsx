// Default (Android) build: no input prompts. PromptBar.web.tsx renders the desktop one.
import type { ActionName } from '../input/inputActions';

export interface PromptItem { action: ActionName; label: string }
interface Props { items: readonly PromptItem[]; compact?: boolean }

export function PromptBar(_props: Props): null { return null; }
