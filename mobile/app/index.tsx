import { Redirect } from "expo-router";

// The gate in _layout decides where to go; this just gives the router
// a concrete entry point.
export default function Index() {
  return <Redirect href="/join" />;
}
