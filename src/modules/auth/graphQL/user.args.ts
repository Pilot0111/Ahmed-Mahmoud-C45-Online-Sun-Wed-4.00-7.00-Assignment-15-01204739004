import { GraphQLString, GraphQLNonNull, GraphQLInt } from "graphql";
import { GenderType } from "./userType";

export const getUserArgs = () => {
  return {
    id: { type: GraphQLString },
  };
};

export const createUserArgs = () => {
  return {
    userName: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
    cPassword: { type: new GraphQLNonNull(GraphQLString) },
    age: { type: new GraphQLNonNull(GraphQLInt) },
    gender: { type: new GraphQLNonNull(GenderType) },
  };
};