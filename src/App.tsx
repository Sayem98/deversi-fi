import "./App.css";
import { AppKitProvider } from "./context/AppKitProvider";
import Page from "./Page";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <AppKitProvider>
      <Page />
      <Toaster
        position="top-center"
        containerStyle={{ top: 20, bottom: "auto" }}
      />
    </AppKitProvider>
  );
}

export default App;
