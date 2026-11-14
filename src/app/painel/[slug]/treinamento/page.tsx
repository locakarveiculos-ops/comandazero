import { Suspense } from "react";
import { TrainingPage } from "./training-page";

export const metadata = { title: "Central de treinamento" };

export default function Page() {
  return (
    <Suspense>
      <TrainingPage />
    </Suspense>
  );
}
