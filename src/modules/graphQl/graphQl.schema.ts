import {
  GraphQLSchema,
  GraphQLObjectType,
} from "graphql";
import userQueryFields from "../../auth/graphQL/user.fields"; // Import the actual fields object

export const gql_schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "RootQueryType",
    fields: { ...userQueryFields.query() }, // Use the imported query fields object
  }), // end of query
  mutation: new GraphQLObjectType({
    name: "RootMutationType",
    fields: {
      ...userQueryFields.mutation(),
    },
  }), // end of mutation
});
