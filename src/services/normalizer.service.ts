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

interface VoyagerEntity {
    entityUrn?: string;
    $type?: string;
    [key: string]: unknown;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const typeEndsWith = (entity: VoyagerEntity, suffix: string): boolean =>
    typeof entity.$type === "string" && entity.$type.endsWith(suffix);

const formatDateRange = (entity: VoyagerEntity): string => {
    const range = entity.dateRange as { start?: { month?: number; year?: number }; end?: { month?: number; year?: number } } | undefined;
    if (!range?.start) return "";
    const fmt = (d?: { month?: number; year?: number }) => (d?.year ? `${d.month ?? ""}/${d.year}`.replace(/^\//, "") : "");
    const start = fmt(range.start);
    const end = fmt(range.end) || "Present";
    return start ? `${start} - ${end}` : "";
};

/**
 * Extracts a displayable image URL from LinkedIn's vector image format:
 * profilePicture.displayImageReference.vectorImage.{rootUrl,artifacts[]}.
 * Falls back to "" when absent — profile picture privacy settings mean
 * this is often entirely missing from the response.
 */
const extractImageUrl = (picture: unknown): string => {
    if (!picture || typeof picture !== "object") return "";
    const vector = (picture as any)?.displayImageReference?.vectorImage;
    const rootUrl = str(vector?.rootUrl);
    const artifacts = arr(vector?.artifacts);
    const largest = artifacts[artifacts.length - 1] as any;
    const segment = str(largest?.fileIdentifyingUrlPathSegment);
    return rootUrl && segment ? `${rootUrl}${segment}` : "";
};

/**
 * Resolves a `*fieldName`-style REST.li reference (a URN string) against
 * the flat `included` array by matching entityUrn.
 */
const resolveRef = (included: VoyagerEntity[], urn: unknown): VoyagerEntity | undefined =>
    typeof urn === "string" ? included.find((e) => e.entityUrn === urn) : undefined;

const extractLocation = (included: VoyagerEntity[], profileEntity: VoyagerEntity): string => {
    const geoLocation = profileEntity.geoLocation as { "*geo"?: string } | undefined;
    const geoEntity = resolveRef(included, geoLocation?.["*geo"]);
    return str(geoEntity?.defaultLocalizedName);
};

/**
 * Pure function: raw LinkedIn Voyager "normalized+json" payload -> our
 * output schema. LinkedIn's REST.li normalized format returns entity
 * fragments in a flat `included` array (keyed by entityUrn/$type) rather
 * than a nested profile object, so this reassembles the pieces we need.
 * Isolated from network code so it can be unit-tested independently.
 */
export const normalizeProfile = (raw: unknown, sourceUrl: string): NormalizedProfile => {
    if (!raw || typeof raw !== "object") {
        throw new ParseError("LinkedIn response was not a recognizable profile payload");
    }

    const included = arr((raw as Record<string, unknown>).included) as VoyagerEntity[];
    if (included.length === 0) {
        throw new ParseError("LinkedIn response had no `included` entities to normalize");
    }

    try {
        const profileEntity = included.find(
            (e) => typeof e.entityUrn === "string" && e.entityUrn.includes("fsd_profile:") && "firstName" in e
        );

        if (!profileEntity) {
            throw new ParseError("Could not locate the core profile entity in LinkedIn's response");
        }

        const positions = included.filter((e) => typeEndsWith(e, "Position") && "companyName" in e);
        const educations = included.filter((e) => typeEndsWith(e, "Education"));
        const skills = included.filter((e) => typeEndsWith(e, "Skill"));
        const certifications = included.filter((e) => typeEndsWith(e, "Certification"));
        const languages = included.filter((e) => typeEndsWith(e, "Language") || typeEndsWith(e, "LanguageProficiency"));

        const experience: IExperience[] = positions.map((p) => ({
            title: str(p.title),
            company: str(p.companyName),
            duration: formatDateRange(p),
            description: str(p.description),
        }));

        const education: IEducation[] = educations.map((e) => ({
            school: str(e.schoolName),
            degree: str(e.degreeName),
            years: formatDateRange(e),
        }));

        return {
            name: [str(profileEntity.firstName), str(profileEntity.lastName)].filter(Boolean).join(" "),
            headline: str(profileEntity.headline),
            location: extractLocation(included, profileEntity),
            about: str(profileEntity.summary),
            profileImageUrl: extractImageUrl(profileEntity.profilePicture),
            experience,
            education,
            skills: skills.map((s) => str(s.name)).filter(Boolean),
            certifications: certifications.map((c) => str(c.name ?? c.authority)).filter(Boolean),
            languages: languages.map((l) => str(l.name)).filter(Boolean),
            sourceUrl,
            fetchedAt: new Date().toISOString(),
        };
    } catch (error) {
        if (error instanceof ParseError) throw error;
        throw new ParseError("Failed to normalize LinkedIn profile payload");
    }
};
