import {
  BooleanField,
  BooleanInput,
  Create,
  Datagrid,
  DateField,
  Edit,
  EditButton,
  List,
  SearchInput,
  SimpleForm,
  TextField,
  TextInput,
  required,
} from "react-admin";

const userFilters = [<SearchInput key="q" source="q" alwaysOn />];

export function UserList() {
  return (
    <List filters={userFilters}>
      <Datagrid rowClick="edit">
        <TextField source="id" />
        <TextField source="email" />
        <BooleanField source="is_admin" />
        <DateField source="created_at" showTime />
        <EditButton />
      </Datagrid>
    </List>
  );
}

export function UserEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="email" fullWidth validate={required()} />
        <BooleanInput source="is_admin" />
      </SimpleForm>
    </Edit>
  );
}

export function UserCreate() {
  return (
    <Create>
      <SimpleForm>
        <TextInput source="email" fullWidth validate={required()} />
        <BooleanInput source="is_admin" defaultValue={false} />
      </SimpleForm>
    </Create>
  );
}
