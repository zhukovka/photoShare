const { GraphQLServer } = require('graphql-yoga');

const typeDefs = `
    type Query {
        gnar: String
    }
`;

const resolvers = {
    Query: {
        gnar: () => 'gnarly!!!'
    }
};

const server = new GraphQLServer({ typeDefs, resolvers });

var port = 4000

server.express.get('/', (req, res) => {
    res.end(`The PhotoShare Service - http://localhost:${port}/playground`)
})

const options = {
    port,
    endpoint: '/graphql',
    playground: '/playground'
}

const ready = ({ port }) => console.log(`graph service running - http://localhost:${port}`)

server.start(options, ready)