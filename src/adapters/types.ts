// PlatformAdapter interface (FR-1, FR-3, FR-7)
export interface PlatformAdapter {
  id: string;
  name: string;
  matches(url: URL): boolean;
}
