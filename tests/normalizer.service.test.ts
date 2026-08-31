import { normalizeProfile } from "../src/services/normalizer.service";
import { ParseError } from "../src/utils/errors/app.error";

const SOURCE_URL = "https://www.linkedin.com/in/jane-doe";

const geoEntity = {
    entityUrn: "urn:li:fsd_geo:123",
    $type: "com.linkedin.voyager.dash.common.Geo",
    defaultLocalizedName: "San Francisco, California",
};

const profileEntity = {
    entityUrn: "urn:li:fsd_profile:ACoAAA",
    $type: "com.linkedin.voyager.dash.identity.profile.Profile",
    firstName: "Jane",
    lastName: "Doe",
    headline: "Software Engineer",
    summary: "Building things.",
    geoLocation: { "*geo": "urn:li:fsd_geo:123" },
    profilePicture: {
        displayImageReference: {
            vectorImage: {
                rootUrl: "https://media.licdn.com/dms/image/v2/root/",
                artifacts: [
                    { width: 100, fileIdentifyingUrlPathSegment: "small.jpg" },
                    { width: 800, fileIdentifyingUrlPathSegment: "large.jpg" },
                ],
            },
        },
    },
};

const positionEntity = {
    entityUrn: "urn:li:fsd_position:1",
    $type: "com.linkedin.voyager.dash.identity.profile.Position",
    title: "Software Engineer",
    companyName: "Acme Corp",
    description: "Built scalable systems.",
    dateRange: { start: { month: 8, year: 2020 }, end: { month: 6, year: 2023 } },
};

const currentPositionEntity = {
    entityUrn: "urn:li:fsd_position:2",
    $type: "com.linkedin.voyager.dash.identity.profile.Position",
    title: "Senior Engineer",
    companyName: "Beta Inc",
    description: "",
    dateRange: { start: { year: 2023 } },
};

const educationEntity = {
    entityUrn: "urn:li:fsd_education:1",
    $type: "com.linkedin.voyager.dash.identity.profile.Education",
    schoolName: "State University",
    degreeName: "B.S. Computer Science",
    dateRange: { start: { year: 2016 }, end: { year: 2020 } },
};

const skillEntity = {
    entityUrn: "urn:li:fsd_skill:1",
    $type: "com.linkedin.voyager.dash.identity.profile.Skill",
    name: "TypeScript",
};

const certificationEntity = {
    entityUrn: "urn:li:fsd_certification:1",
    $type: "com.linkedin.voyager.dash.identity.profile.Certification",
    name: "Agentic AI Engineering",
    authority: "Some Authority",
};

const languageEntity = {
    entityUrn: "urn:li:fsd_language:1",
    $type: "com.linkedin.voyager.dash.identity.profile.LanguageProficiency",
    name: "English",
};

const buildRawPayload = (included: unknown[]) => ({ included });

describe("normalizeProfile", () => {
    it("throws ParseError when raw is not an object", () => {
        expect(() => normalizeProfile(null, SOURCE_URL)).toThrow(ParseError);
        expect(() => normalizeProfile("string", SOURCE_URL)).toThrow(ParseError);
        expect(() => normalizeProfile(undefined, SOURCE_URL)).toThrow(ParseError);
    });

    it("throws ParseError when included is missing or empty", () => {
        expect(() => normalizeProfile({}, SOURCE_URL)).toThrow(ParseError);
        expect(() => normalizeProfile({ included: [] }, SOURCE_URL)).toThrow(ParseError);
    });

    it("throws ParseError when the core profile entity cannot be located", () => {
        const raw = buildRawPayload([positionEntity, educationEntity]);
        expect(() => normalizeProfile(raw, SOURCE_URL)).toThrow(ParseError);
        expect(() => normalizeProfile(raw, SOURCE_URL)).toThrow(
            /Could not locate the core profile entity/
        );
    });

    it("normalizes a full profile payload into the output schema", () => {
        const raw = buildRawPayload([
            profileEntity,
            geoEntity,
            positionEntity,
            currentPositionEntity,
            educationEntity,
            skillEntity,
            certificationEntity,
            languageEntity,
        ]);

        const result = normalizeProfile(raw, SOURCE_URL);

        expect(result.name).toBe("Jane Doe");
        expect(result.headline).toBe("Software Engineer");
        expect(result.about).toBe("Building things.");
        expect(result.location).toBe("San Francisco, California");
        expect(result.profileImageUrl).toBe(
            "https://media.licdn.com/dms/image/v2/root/large.jpg"
        );
        expect(result.sourceUrl).toBe(SOURCE_URL);
        expect(typeof result.fetchedAt).toBe("string");
        expect(() => new Date(result.fetchedAt).toISOString()).not.toThrow();

        expect(result.experience).toEqual([
            {
                title: "Software Engineer",
                company: "Acme Corp",
                duration: "8/2020 - 6/2023",
                description: "Built scalable systems.",
            },
            {
                title: "Senior Engineer",
                company: "Beta Inc",
                duration: "2023 - Present",
                description: "",
            },
        ]);

        expect(result.education).toEqual([
            { school: "State University", degree: "B.S. Computer Science", years: "2016 - 2020" },
        ]);

        expect(result.skills).toEqual(["TypeScript"]);
        expect(result.certifications).toEqual(["Agentic AI Engineering"]);
        expect(result.languages).toEqual(["English"]);
    });

    it("falls back to the certification authority when name is absent", () => {
        const certWithoutName = { ...certificationEntity, name: undefined, authority: "Coursera" };
        const raw = buildRawPayload([profileEntity, certWithoutName]);

        const result = normalizeProfile(raw, SOURCE_URL);

        expect(result.certifications).toEqual(["Coursera"]);
    });

    it("returns empty arrays/strings for a sparsely-filled profile", () => {
        const minimalProfile = {
            entityUrn: "urn:li:fsd_profile:minimal",
            $type: "com.linkedin.voyager.dash.identity.profile.Profile",
            firstName: "John",
            lastName: "Smith",
        };
        const raw = buildRawPayload([minimalProfile]);

        const result = normalizeProfile(raw, SOURCE_URL);

        expect(result.name).toBe("John Smith");
        expect(result.headline).toBe("");
        expect(result.location).toBe("");
        expect(result.about).toBe("");
        expect(result.profileImageUrl).toBe("");
        expect(result.experience).toEqual([]);
        expect(result.education).toEqual([]);
        expect(result.skills).toEqual([]);
        expect(result.certifications).toEqual([]);
        expect(result.languages).toEqual([]);
    });

    it("does not resolve a geo reference that isn't present in `included`", () => {
        const raw = buildRawPayload([profileEntity]); // geoEntity omitted
        const result = normalizeProfile(raw, SOURCE_URL);
        expect(result.location).toBe("");
    });

    it("does not misclassify a position missing companyName", () => {
        const incompletePosition = {
            entityUrn: "urn:li:fsd_position:3",
            $type: "com.linkedin.voyager.dash.identity.profile.Position",
            title: "Contractor",
        };
        const raw = buildRawPayload([profileEntity, incompletePosition]);
        const result = normalizeProfile(raw, SOURCE_URL);
        expect(result.experience).toEqual([]);
    });
});
