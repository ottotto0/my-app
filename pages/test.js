// pages/test.js
import dynamic from "next/dynamic";

const TestClient = dynamic(() => import("../components/TestClient"), {
  ssr: false, // これが重要！document が使える
});

export default function Page() {
  return <TestClient />;
}
