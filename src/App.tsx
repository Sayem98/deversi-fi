import "./App.css";
import { AppKitProvider } from "./context/AppKitProvider";
import Page from "./Page";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <AppKitProvider>
      <Page />
      <Toaster />
    </AppKitProvider>
  );
}

export default App;
