import { createContext, useContext } from "react";

export interface ViewAsState {
  viewAsUserId: number | null;
  viewAsName: string | null;
}

export const ViewAsContext = createContext<ViewAsState>({
  viewAsUserId: null,
  viewAsName: null,
});

export function useViewAs() {
  return useContext(ViewAsContext);
}
