import { Schema, model, Document } from "mongoose";

export type RequestLogStatus = "pending" | "success" | "failed" | "rate_limited";

export interface IRequestLog extends Document {
    linkedinUrl: string;
    status: RequestLogStatus;
    errorMessage?: string;
}

const RequestLogSchema = new Schema<IRequestLog>({
    linkedinUrl: String,
    status: { type: String, enum: ["pending", "success", "failed", "rate_limited"] },
    errorMessage: String,
}, { timestamps: true });

export const RequestLog = model<IRequestLog>("RequestLog", RequestLogSchema);
