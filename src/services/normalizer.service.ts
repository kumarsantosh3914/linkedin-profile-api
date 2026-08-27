import { ParseError } from "../utils/errors/app.error";
import { IExperience, IEducation } from "../models/profile.model";

export interface NormalizedProfile {
    name: string;
    headline: string;
    location: string;
    about: string;
    profileImageUrl: string;
    experience: IExperience[];
    education: IEducation[];
    skills: string[];
    certifications: string[];
    languages: string[];
    sourceUrl: string;
    fetchedAt: string;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Pure function: raw LinkedIn Voyager payload -> our output schema.
 * Isolated from network code so it can be unit-tested independently.
 */
export const normalizeProfile = (raw: unknown, sourceUrl: string): NormalizedProfile => {
    if (!raw || typeof raw !== "object") {
        throw new ParseError("LinkedIn response was not a recognizable profile payload");
    }

    const data = raw as Record<string, any>;

    try {
        const experience: IExperience[] = arr(data.experience).map((exp: any) => ({
            title: str(exp?.title),
            company: str(exp?.companyName),
            duration: str(exp?.duration),
            description: str(exp?.description),
        }));

        const education: IEducation[] = arr(data.education).map((edu: any) => ({
            school: str(edu?.schoolName),
            degree: str(edu?.degreeName),
            years: str(edu?.years),
        }));

        return {
            name: str(data.name),
            headline: str(data.headline),
            location: str(data.location),
            about: str(data.about ?? data.summary),
            profileImageUrl: str(data.profileImageUrl),
            experience,
            education,
            skills: arr(data.skills).map((s: any) => str(s?.name ?? s)),
            certifications: arr(data.certifications).map((c: any) => str(c?.name ?? c)),
            languages: arr(data.languages).map((l: any) => str(l?.name ?? l)),
            sourceUrl,
            fetchedAt: new Date().toISOString(),
        };
    } catch (error) {
        throw new ParseError("Failed to normalize LinkedIn profile payload");
    }
};
