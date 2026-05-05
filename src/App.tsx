import { useApp } from "./contexts/AppContext";
import { AuthScreen } from "./components/auth/AuthScreen";
import { Sidebar } from "./components/chat/Sidebar";
import { ChatWindow } from "./components/chat/ChatWindow";
import { ToastContainer } from "./components/ui/Toast";

export function App() {
  const { state } = useApp();

  if (!state.user) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="h-screen flex bg-bg-primary overflow-hidden">
      <div
        className={`
          flex-shrink-0 w-72
          ${state.activeConversationId ? "hidden md:flex" : "flex"}
          flex-col h-full
        `}
      >
        <Sidebar />
      </div>

      {/* Chat area */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 h-full
          ${!state.activeConversationId ? "hidden md:flex" : "flex"}
        `}
      >
        <ChatWindow />
      </div>

      <ToastContainer />
    </div>
  );
}
