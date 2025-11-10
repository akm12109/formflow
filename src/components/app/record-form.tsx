import { FormRecord } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RecordFormProps {
  record: FormRecord;
}

const FormField: React.FC<{ label: string; value: string | undefined, component?: 'input' | 'textarea' }> = ({ label, value, component = 'input' }) => {
    const Component = component === 'textarea' ? Textarea : Input;
    return (
        <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={label} className="text-right">
                {label}
            </Label>
            <Component id={label} value={value || ''} readOnly className="col-span-3" />
        </div>
    );
};

export default function RecordForm({ record }: RecordFormProps) {
  return (
    <div className="grid gap-4 py-4">
      <FormField label="Name" value={record.name} />
      <FormField label="Email" value={record.email} />
      <FormField label="Retype Email" value={record.retypeEmail} />
      <FormField label="Password" value={record.password} />
      <FormField label="Retype Password" value={record.retypePassword} />
      <FormField label="Age" value={record.age} />
      <FormField label="Gender" value={record.gender} />
      <FormField label="Marital Status" value={record.maritalStatus} />
      <FormField label="Education" value={record.education} />
      <FormField label="Occupation" value={record.occupation} />
      <FormField label="Religion" value={record.religion} />
      <FormField label="Education Details" value={record.educationDetails} />
      <FormField label="Caste" value={record.caste} />
      <FormField label="Sub Caste" value={record.subCaste} />
      <FormField label="Gothra" value={record.gothra} />
      <FormField label="Mother Tongue" value={record.motherTongue} />
      <FormField label="Horoscope Match" value={record.horoscopeMatch} />
      <FormField label="Star" value={record.star} />
      <FormField label="Raasi/Moon Sign" value={record.raasiMoonSign} />
      <FormField label="Dosham/Manglik" value={record.doshamManglik} />
      <FormField label="Height (Feet)" value={record.heightFeet} />
      <FormField label="Height (Inches)" value={record.heightInches} />
      <FormField label="Height (Cms)" value={record.heightCms} />
      <FormField label="Weight (Kg)" value={record.weightKg} />
      <FormField label="Weight (Lbs)" value={record.weightLbs} />
      <FormField label="Citizenship" value={record.citizenship} />
      <FormField label="Country Living In" value={record.countryLivingIn} />
      <FormField label="Home State" value={record.homeState} />
      <FormField label="Home City/District" value={record.homeCityDistrict} />
      <FormField label="State/City Living In" value={record.stateCityLivingIn} />
      <FormField label="Body Type" value={record.bodyType} />
      <FormField label="Complexion" value={record.complexion} />
      <FormField label="Physical Status" value={record.physicalStatus} />
      <FormField label="Eating Habit" value={record.eatingHabit} />
      <FormField label="Drinking Habit" value={record.drinkingHabit} />
      <FormField label="Smoking Habit" value={record.smokingHabit} />
      <FormField label="Family Value" value={record.familyValue} />
      <FormField label="Family Type" value={record.familyType} />
      <FormField label="Family Status" value={record.familyStatus} />
      <FormField label="Annual Income" value={record.annualIncome} />
      <FormField label="How To Know About Us" value={record.howToKnowAboutUs} />
      <FormField label="About Parents/Siblings" value={record.aboutParentsSiblings} component="textarea" />
      <FormField label="More About Self" value={record.moreAboutSelf} component="textarea" />
      <FormField label="Your Expectation" value={record.yourExpectation} component="textarea" />
    </div>
  );
}
