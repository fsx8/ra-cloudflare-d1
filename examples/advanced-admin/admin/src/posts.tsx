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

const postFilters = [
  <SearchInput key="q" source="q" alwaysOn />,
  <TextInput key="status" source="status" />,
  <BooleanInput
    key="includeDeleted"
    source="_includeDeleted"
    label="Include deleted"
  />,
];

export function PostList() {
  return (
    <List filters={postFilters}>
      <Datagrid rowClick="edit">
        <TextField source="id" />
        <TextField source="title" />
        <TextField source="status" />
        <BooleanField source="is_featured" />
        <DateField source="created_at" showTime />
        <EditButton />
      </Datagrid>
    </List>
  );
}

export function PostEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="title" fullWidth validate={required()} />
        <TextInput source="body" fullWidth multiline />
        <TextInput source="status" />
        <BooleanInput source="is_featured" />
      </SimpleForm>
    </Edit>
  );
}

export function PostCreate() {
  return (
    <Create>
      <SimpleForm>
        <TextInput source="title" fullWidth validate={required()} />
        <TextInput source="body" fullWidth multiline />
        <TextInput source="status" defaultValue="draft" />
        <BooleanInput source="is_featured" defaultValue={false} />
      </SimpleForm>
    </Create>
  );
}
