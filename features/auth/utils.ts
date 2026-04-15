export function getDisplayName(email: string | undefined, metadataName: unknown) {
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  if (!email) return 'Competidor';

  return email.split('@')[0];
}
