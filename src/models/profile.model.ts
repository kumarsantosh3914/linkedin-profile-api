import { Schema, model, Document } from "mongoose";

export interface IExperience {
    title?: string;
    company?: string;
    duration?: string;
    description?: string;
}

export interface IEducation {
    school?: string;
    degree?: string;
    years?: string;
}

export interface IProfile extends Document {
    linkedinUrl: string;
    name?: string;
    headline?: string;
    location?: string;
    about?: string;
    profileImageUrl?: string;
    experience: IExperience[];
    education: IEducation[];
    skills: string[];
    certifications: string[];
    languages: string[];
    rawJson?: unknown;
    fetchedAt?: Date;
    expiresAt?: Date;
}

const ExperienceSchema = new Schema<IExperience>({
    title: String,
    company: String,
    duration: String,
    description: String,
}, { _id: false });

const EducationSchema = new Schema<IEducation>({
    school: String,
    degree: String,
    years: String,
}, { _id: false });

const ProfileSchema = new Schema<IProfile>({
    linkedinUrl: { type: String, required: true, unique: true, index: true },
    name: String,
    headline: String,
    location: String,
    about: String,
    profileImageUrl: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    skills: [String],
    certifications: [String],
    languages: [String],
    rawJson: Schema.Types.Mixed,
    fetchedAt: Date,
    expiresAt: { type: Date, index: true },
}, { timestamps: true });

export const Profile = model<IProfile>("Profile", ProfileSchema);
