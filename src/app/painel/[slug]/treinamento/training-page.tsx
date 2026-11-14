"use client";

import { useParams } from "next/navigation";
import { TrainingCenter } from "@/components/training/training-center";

export function TrainingPage() {
  const { slug } = useParams<{ slug: string }>();
  return <TrainingCenter slug={slug} />;
}
