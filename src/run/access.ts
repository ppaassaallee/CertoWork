/** Private rollout. Workspace role, flags and invites never grant Run access. */
export function canUseCertoRun(user: { email?: string | null; emailVerified?: boolean } | null | undefined): boolean {
  return user?.emailVerified === true && user.email?.trim().toLowerCase() === "alejandro@getboldr.ai";
}
