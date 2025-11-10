import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export const FormRecordSchema = z.object({
  name: z.string(),
  gender: z.string(),
  age: z.string(),
  maritalStatus: z.string(),
  education: z.string(),
  occupation: z.string().optional(),
  religion: z.string().optional(),
  educationDetails: z.string(),
  caste: z.string(),
  subCaste: z.string(),
  gothra: z.string(),
  motherTongue: z.string(),
  horoscopeMatch: z.string(),
  star: z.string(),
  raasiMoonSign: z.string(),
  doshamManglik: z.string(),
  heightFeet: z.string(),
  heightCms: z.string(),
  heightInches: z.string(),
  weightKg: z.string(),
  weightLbs: z.string(),
  citizenship: z.string(),
  homeState: z.string(),
  homeCityDistrict: z.string(),
  countryLivingIn: z.string(),
  stateCityLivingIn: z.string(),
  email: z.string().email(),
  retypeEmail: z.string().email(),
  bodyType: z.string(),
  complexion: z.string(),
  physicalStatus: z.string(),
  eatingHabit: z.string(),
  drinkingHabit: z.string(),
  smokingHabit: z.string(),
  familyValue: z.string(),
  familyType: z.string(),
  familyStatus: z.string(),
  annualIncome: z.string(),
  aboutParentsSiblings: z.string(),
  moreAboutSelf: z.string(),
  yourExpectation: z.string(),
  password: z.string(),
  retypePassword: z.string(),
  howToKnowAboutUs: z.string(),
});

export type FormRecord = z.infer<typeof FormRecordSchema>;

export type Suggestion = {
  suggestedContent: string;
  reasoning?: string;
};

export type UserPresence = {
    id: string;
    email: string;
    lastSeen: Timestamp;
};
