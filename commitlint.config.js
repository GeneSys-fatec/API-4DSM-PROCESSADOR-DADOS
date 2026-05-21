export default {
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)\[(.*)\]:\s+(.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject']
    }
  },
  
  defaultIgnores: true,
  ignores: [(commit) => commit.includes("Merge")],
  
  rules: {
    'type-enum': [
      2, 
      'always', 
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'cd']
    ],
    'type-empty': [2, 'never'],
    
    'scope-empty': [2, 'never'],
    
    'subject-empty': [2, 'never'],
  }
};