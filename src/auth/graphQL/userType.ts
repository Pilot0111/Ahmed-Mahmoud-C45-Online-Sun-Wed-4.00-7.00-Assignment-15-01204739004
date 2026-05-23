import { GraphQLObjectType, GraphQLString, GraphQLEnumType } from "graphql";

export const GenderType = new GraphQLEnumType({
  name: "Gender",
  values: {
    male: { value: "male" },
    female: { value: "female" },
  },
});

export const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: GraphQLString, resolve: (parent: any) => parent._id.toString() },
    userName: { type: GraphQLString },
    email: { type: GraphQLString },
    gender: { type: GenderType },
  },
});