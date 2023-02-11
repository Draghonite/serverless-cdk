pipeline {
  agent { docker { image 'node:16.17.1-alpine' } }
  stages {
    stage('build') {
      steps {
        sh 'node --version'
        echo 'build stage'
        echo '${BUILD_NUMBER}'
      }
    }
  }
}
