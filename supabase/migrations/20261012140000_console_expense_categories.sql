-- More expense categories, so everyday business costs have a proper home instead of "Other":
--   utilities  : internet, power, phone and data
--   travel     : travel and transport
--   equipment  : equipment and office
-- Existing rows keep their category; re-categorise an existing expense by editing it.

alter table console.expenses drop constraint if exists expenses_category_check;
alter table console.expenses
  add constraint expenses_category_check check (category in (
    'infrastructure', 'software', 'utilities', 'people', 'marketing',
    'travel', 'equipment', 'legal_tax', 'banking_fees', 'other'
  ));

notify pgrst, 'reload schema';
