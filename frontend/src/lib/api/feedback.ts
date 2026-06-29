import { api } from "./client";

export interface FeedbackInput {
  subject?: string;
  message: string;
  page?: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<{ id: number; status: string }> {
  const res = await api<{ data: { id: number; status: string } }>("/feedback", {
    method: "POST",
    json: {
      subject: input.subject || null,
      message: input.message,
      page: input.page || null,
    },
  });
  return res.data;
}
