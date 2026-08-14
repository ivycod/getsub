import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/index.css";
import App from "@/App";
import { TermsPage, PrivacyPage, RefundsPage, ContactPage } from "@/pages/Legal";
import ProductPage from "@/pages/ProductPage";
import OrderPage from "@/pages/OrderPage";
import AdminPage from "@/pages/AdminPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/order/:token" element={<OrderPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/:slug" element={<ProductPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refunds" element={<RefundsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
