'use server';
/**
 * @fileOverview A Genkit flow for generating a structured user record from a text description.
 *
 * - generateRecord - A function that takes a form number and description to generate a user record.
 * - GenerateRecordInput - The input type for the generateRecord function.
 * - FormRecord - The return type for the generateRecord function (imported from lib/types).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { FormRecord, FormRecordSchema } from '@/lib/types';

const GenerateRecordInputSchema = z.object({
  formNo: z.string().describe('The form number for the record.'),
  description: z.string().describe('A natural language description of the person.'),
});

export type GenerateRecordInput = z.infer<typeof GenerateRecordInputSchema>;

const prompt = ai.definePrompt({
    name: 'generateRecordPrompt',
    input: { schema: GenerateRecordInputSchema },
    output: { schema: FormRecordSchema },
    prompt: `
      You are an expert at parsing user descriptions and converting them into structured JSON data.
      Generate a single JSON record based on the provided form number and description.

      formNo={{{formNo}}}
      Description: {{{description}}}

      Adhere strictly to the following structure, data types, and constraints:
      - name: string
      - age: string
      - gender: string
      - education: string
      - occupation: string
      - religion: string (Accepted values: "Hindu", "Muslim", "Sikh", "Christian", "Other")
      - caste: string
      - gothra: string
      - motherTongue: string
      - horoscopeMatch: string
      - star: string (Accepted values: "Ashwini", "Bharani", "Krittika", "Other")
      - raasiMoonSign: string
      - doshamManglik: string ("Yes", "No", "Other")
      - heightFeet: string ( include ft is important e.g., "5 ft")
      - heightInches: string (include in is important e.g., "7 in")
      - heightCms: string (include cm is important e.g., "170 cm")
      - weightKg: string (include kg is important e.g., "76 kg")
      - weightLbs: string (include lbs is important e.g., "138 lbs")
      - citizenship: string (MUST be one of: "India", "USA", "Canada")
      - homeState: string
      - bodyType: string ("Slim" ,"Average", "Athletic", "Heavy" "Other")
      - complexion: string
      - physicalStatus: string
      - eatingHabit: string ("Vegetarian", "Non-Vegetarian", "Eggetarian", "Others")
      - drinkingHabit: string 
      - smokingHabit: string ("No", "Occasionally", "Yes", "Other")
      - familyValue: string ("Other", "Traditional", "Moderate", "Liberal")
      - familyType: string ("Joint", "Nuclear")
      - familyStatus: string 
      - annualIncome: string
      - aboutParentsSiblings: string (add full stop at last of sentence (.))
      - moreAboutSelf: string (add full stop at last of sentence (.))
      - yourExpectation: string (add full stop at last of sentence (.))
      - maritalStatus: string

      The following fields MUST be derived from other fields:
      - email: string (format: {{{formNo}}}_Name@nitresearchcenter.com, where Name is the person's name with spaces replaced by underscores)
      - retypeEmail: string (must match email)
      - password: string (format: Name@1234, where Name is the person's first name)
      - retypePassword: string (must match password)
      - educationDetails: string (same as education)
      - subCaste: string (same as caste)
      - homeCityDistrict: string (same as homeState)
      - countryLivingIn: string (MUST be the same as citizenship)
      - stateCityLivingIn: string (same as homeState)
      - howToKnowAboutUs: string (MUST be "My Friend")
    `,
});

const generateRecordFlow = ai.defineFlow(
  {
    name: 'generateRecordFlow',
    inputSchema: GenerateRecordInputSchema,
    outputSchema: FormRecordSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a valid record.");
    }
    return output;
  }
);

export async function generateRecord(input: GenerateRecordInput): Promise<FormRecord> {
    return await generateRecordFlow(input);
}
